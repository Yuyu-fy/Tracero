"""Tracero 后端服务的入口文件。

这份文件做了四件事：
1. 定义浏览器或其他程序可以调用的 HTTP 接口（FastAPI 路由）；
2. 把收到的机器人异常事件整理为 ``evidence``（证据）；
3. 调用 DeepSeek，让模型基于证据生成故障分析；
4. 将任务及其结果保存到 SQLite 数据库中，供前端后续查询。

可以把一次分析理解为一条 ``run``（任务记录）。它会依次经历：
``received（已接收） -> reasoning（证据已准备） -> completed（已完成）``。
"""

# 标准库：Python 自带，不需要额外安装。
import json  # Python 字典/列表 与 JSON 字符串之间的转换。
import os  # 读取环境变量、拼接文件路径。
import re  # 使用正则表达式检查模型回答中引用的证据编号。
import sqlite3  # 使用 SQLite 本地数据库。
import urllib.error  # 捕获 HTTP 请求错误。
import urllib.request  # 向 DeepSeek API 发送 HTTP 请求。
import uuid  # 生成几乎不会重复的任务 ID。
from datetime import datetime, timezone  # 记录带时区的创建时间。
from typing import Optional  # 表示字段可以是字符串，也可以没有值（None）。

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


# 创建 FastAPI 应用对象。运行 uvicorn 时，通常会通过 ``app:app`` 找到它。
app = FastAPI(title="Tracero Backend")

# 本机开发使用默认地址；部署后在服务器设置 CORS_ALLOW_ORIGINS，
# 例如：CORS_ALLOW_ORIGINS=https://tracero-frontend.example.com
cors_allow_origins = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allow_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)

# SQLite 是一个保存在当前文件夹里的小型数据库文件。
DATABASE_PATH = os.path.join(os.path.dirname(__file__), "tracero.db")


class ReasonRequest(BaseModel):
    """``POST /api/debug/reason`` 接收的请求体格式。

    Pydantic 会在请求到达接口前校验数据：若缺少字段或类型明显错误，
    FastAPI 会自动返回 422 错误，而不会继续执行后面的业务代码。
    """

    # 证据的来源/类别，例如 runtime（运行时）或 mock（测试数据）。
    evidence_type: str
    # 多条证据；dict 保留灵活的字段结构，具体内容由调用方提供。
    evidence: list[dict]


class EventIngestRequest(BaseModel):
    """A 同学的 Agent 在检测到异常后发送的事件切片。

    这是一份“原始事件”。程序先原样存储它，再从中提取标准化证据。
    """

    # 异常类别，例如碰撞、温度异常等。
    event_type: str
    # 触发异常的 Unix 时间戳（从 1970-01-01 开始累计的秒数）。
    trigger_time: float
    # 产生事件的机器人编号。
    robot_id: str
    # 关键帧窗口；通常形如 {"before": [...], "after": [...]}。
    window: dict
    # 参数快照。default_factory=dict 可避免多个请求意外共用同一个空字典。
    params_snapshot: dict = Field(default_factory=dict)
    # 静态索引版本可不传，因此类型是 Optional[str]，默认值为 None。
    static_index_version: Optional[str] = None


class StaticIndexIngestRequest(BaseModel):
    """A 的 tree-sitter 分析结果：topic 到源码位置的映射。"""

    version: str
    index: dict


class ParamsSnapshotIngestRequest(BaseModel):
    """A 在机器人启动时上传的全量参数快照。"""

    timestamp: float
    params: dict


def get_connection():
    """打开并返回一个数据库连接；调用方必须在完成后关闭它。

    ``row_factory`` 的作用是让查询结果可用 ``row["run_id"]`` 取值，
    比只能通过 ``row[0]`` 取值更易读。
    """
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_database():
    """在服务启动时确保 ``runs`` 表存在，并兼容旧版本数据库。

    ``CREATE TABLE IF NOT EXISTS`` 是幂等操作：表已存在时不会删除或覆盖数据。
    """
    connection = get_connection()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                -- 每次诊断任务的唯一 ID，例如 run-a1b2c3d4。
                run_id TEXT PRIMARY KEY,
                -- 证据类别（如 runtime），用于说明这次任务的输入类型。
                evidence_type TEXT NOT NULL,
                -- 事件触发时刻与机器人 ID；调试分析接口创建的旧记录可为空。
                trigger_time REAL,
                robot_id TEXT,
                -- 当前阶段和便于前端展示的进度说明。
                status TEXT NOT NULL,
                progress TEXT,
                -- 原始事件与整理后的证据，均以 JSON 字符串保存在 TEXT 字段中。
                raw_event_json TEXT,
                evidence_json TEXT NOT NULL,
                -- LLM 的文本分析，以及验证分析是否合格的结果。
                output TEXT NOT NULL,
                verified INTEGER NOT NULL,
                errors_json TEXT NOT NULL,
                valid_evidence_ids_json TEXT NOT NULL,
                -- ISO 8601 格式的 UTC 创建时间。
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS static_indexes (
                version TEXT PRIMARY KEY,
                index_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS params_snapshots (
                snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp REAL NOT NULL,
                params_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        ensure_runs_columns(connection)
        connection.commit()
    finally:
        connection.close()


def ensure_runs_columns(connection):
    """为旧版 ``runs`` 表补齐新增列，避免升级后查询失败。

    SQLite 不支持 ``ADD COLUMN IF NOT EXISTS``，所以先通过 ``PRAGMA table_info``
    读取已有列，再只添加缺少的列。
    """
    existing_columns = {
        row["name"] for row in connection.execute("PRAGMA table_info(runs)")
    }
    missing_columns = {
        "trigger_time": "REAL",
        "robot_id": "TEXT",
        "progress": "TEXT",
        "raw_event_json": "TEXT",
    }

    for name, column_type in missing_columns.items():
        if name not in existing_columns:
            connection.execute(f"ALTER TABLE runs ADD COLUMN {name} {column_type}")


def new_run_id():
    """生成一次诊断任务的唯一编号。

    ``uuid.uuid4().hex`` 是一长串随机十六进制字符；这里只取前 8 位，
    使 ID 更短、更适合展示，同时加上 ``run-`` 前缀以说明其用途。
    """
    return f"run-{uuid.uuid4().hex[:8]}"


def save_run(mock_data, output, errors, valid_evidence_ids):
    """保存“直接调用分析接口”产生的完整任务记录。

    参数中的 ``mock_data`` 是请求中的证据，``output`` 是模型回答；
    ``errors`` 为空代表输出通过了格式及证据引用校验。
    """
    run_id = new_run_id()
    created_at = datetime.now(timezone.utc).isoformat()
    # 没有验证错误时才视为已验证。SQLite 没有原生布尔类型，会保存为 0/1。
    verified = len(errors) == 0

    connection = get_connection()
    try:
        connection.execute(
            """
            -- 使用 ? 占位符把 SQL 语句与数据分开，既清晰又能避免 SQL 注入。
            INSERT INTO runs (
                run_id, evidence_type, status, evidence_json, output,
                verified, errors_json, valid_evidence_ids_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                mock_data["evidence_type"],
                "completed" if verified else "verification_failed",
                json.dumps(mock_data["evidence"], ensure_ascii=False),
                output,
                verified,
                json.dumps(errors, ensure_ascii=False),
                json.dumps(sorted(valid_evidence_ids), ensure_ascii=False),
                created_at,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    return run_id, created_at, verified


def create_received_run(event):
    """接收事件后立即落库，创建一条处于 ``received`` 状态的任务。

    先保存、再进行后台处理，即使后续证据构建失败，原始事件也仍可追查。
    """
    run_id = new_run_id()
    created_at = datetime.now(timezone.utc).isoformat()
    # Pydantic 模型转成普通字典，之后才能序列化并存进数据库。
    raw_event = event.dict()

    connection = get_connection()
    try:
        connection.execute(
            """
            INSERT INTO runs (
                run_id, evidence_type, trigger_time, robot_id, status, progress,
                raw_event_json, evidence_json, output, verified, errors_json,
                valid_evidence_ids_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                event.event_type,
                event.trigger_time,
                event.robot_id,
                "received",
                "已接收事件，等待构建证据",
                json.dumps(raw_event, ensure_ascii=False),
                "[]",
                "",
                False,
                "[]",
                "[]",
                created_at,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    return run_id, created_at


def save_static_index(static_index):
    """按版本保存静态索引；同一版本重复上传时覆盖旧内容。"""
    created_at = datetime.now(timezone.utc).isoformat()
    connection = get_connection()
    try:
        connection.execute(
            """
            INSERT INTO static_indexes (version, index_json, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(version) DO UPDATE SET
                index_json = excluded.index_json,
                created_at = excluded.created_at
            """,
            (
                static_index.version,
                json.dumps(static_index.index, ensure_ascii=False),
                created_at,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    return created_at


def get_static_index(version):
    """读取指定版本的静态索引；事件未指定或索引不存在时返回空映射。"""
    if not version:
        return {}

    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT index_json FROM static_indexes WHERE version = ?", (version,)
        ).fetchone()
    finally:
        connection.close()

    return json.loads(row["index_json"]) if row else {}


def save_params_snapshot(snapshot):
    """保存 A 启动时上传的参数快照。"""
    created_at = datetime.now(timezone.utc).isoformat()
    connection = get_connection()
    try:
        connection.execute(
            """
            INSERT INTO params_snapshots (timestamp, params_json, created_at)
            VALUES (?, ?, ?)
            """,
            (
                snapshot.timestamp,
                json.dumps(snapshot.params, ensure_ascii=False),
                created_at,
            ),
        )
        connection.commit()
    finally:
        connection.close()

    return created_at


def get_params_snapshot_at(timestamp):
    """获取事件发生前最近的一份参数快照。"""
    connection = get_connection()
    try:
        row = connection.execute(
            """
            SELECT params_json FROM params_snapshots
            WHERE timestamp <= ?
            ORDER BY timestamp DESC
            LIMIT 1
            """,
            (timestamp,),
        ).fetchone()
    finally:
        connection.close()

    return json.loads(row["params_json"]) if row else {}


def query_runtime_data(run_id, topic=None, start_time=None, end_time=None):
    """查询某次事件中指定 topic、指定时间范围内的运行时关键帧。"""
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT raw_event_json FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
    finally:
        connection.close()

    if row is None or not row["raw_event_json"]:
        return []

    frames = []
    window = json.loads(row["raw_event_json"]).get("window", {})
    for window_name, entries in window.items():
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, dict) or (
                topic is not None and entry.get("topic") != topic
            ):
                continue

            timestamp = entry.get("timestamp")
            if start_time is not None and (
                not isinstance(timestamp, (int, float)) or timestamp < start_time
            ):
                continue
            if end_time is not None and (
                not isinstance(timestamp, (int, float)) or timestamp > end_time
            ):
                continue

            frames.append({"window": window_name, **entry})

    return frames


def query_message_mapping(run_id, topic):
    """根据事件绑定的静态索引，查询 topic 对应的消息/源码映射。"""
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT raw_event_json FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
    finally:
        connection.close()

    if row is None or not row["raw_event_json"]:
        return {}

    event = json.loads(row["raw_event_json"])
    mapping = get_static_index(event.get("static_index_version")).get(topic)
    return {"topic": topic, **mapping} if isinstance(mapping, dict) else {}


def query_source_code(run_id, topic):
    """返回静态索引中记录的源码位置与片段。"""
    mapping = query_message_mapping(run_id, topic)
    publisher = mapping.get("publisher") if mapping else None
    if not isinstance(publisher, dict):
        return {}

    return {
        "file": publisher.get("file"),
        "line": publisher.get("line"),
        "snippet": publisher.get("snippet", ""),
    }


AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "query_runtime_data",
            "description": "查询当前诊断任务中某个 ROS topic 的运行时关键帧。",
            "parameters": {
                "type": "object",
                "properties": {
                    "topic": {"type": "string"},
                    "start_time": {"type": "number"},
                    "end_time": {"type": "number"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_message_mapping",
            "description": "查询当前任务中某个 ROS topic 对应的节点与源码映射。",
            "parameters": {
                "type": "object",
                "properties": {"topic": {"type": "string"}},
                "required": ["topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_source_code",
            "description": "查询当前任务中某个 ROS topic 对应的源码位置与片段。",
            "parameters": {
                "type": "object",
                "properties": {"topic": {"type": "string"}},
                "required": ["topic"],
            },
        },
    },
]


def append_tool_evidence(run_id, evidence):
    """把一次工具查询结果保存为新证据，并分配下一个 evidence_id。"""
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT evidence_json FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
        if row is None:
            return None

        evidence_list = json.loads(row["evidence_json"])
        numbers = [
            int(item["evidence_id"].split("-")[1])
            for item in evidence_list
            if re.fullmatch(r"E-\d+", item.get("evidence_id", ""))
        ]
        evidence["evidence_id"] = f"E-{max(numbers, default=0) + 1:02d}"
        evidence_list.append(evidence)
        connection.execute(
            "UPDATE runs SET evidence_json = ? WHERE run_id = ?",
            (json.dumps(evidence_list, ensure_ascii=False), run_id),
        )
        connection.commit()
    finally:
        connection.close()

    return evidence


def execute_agent_tool(run_id, name, arguments):
    """执行模型请求的只读查询，并将有结果的查询保存为新证据。"""
    if name == "query_runtime_data":
        # 不直接使用 **arguments：即使模型多传了一个字段，也不会让整个任务报错。
        result = query_runtime_data(
            run_id,
            topic=arguments.get("topic"),
            start_time=arguments.get("start_time"),
            end_time=arguments.get("end_time"),
        )
        evidence = {
            "type": "runtime",
            "visible_to": ["dev", "test", "ops"],
            "source": "query_runtime_data",
            "data": result,
        }
    elif name == "query_message_mapping":
        topic = arguments.get("topic")
        if not topic:
            return {"error": "缺少 topic 参数"}, None
        result = query_message_mapping(run_id, topic)
        evidence = {
            "type": "message_mapping",
            "visible_to": ["dev", "test"],
            "source": "query_message_mapping",
            "data": result,
        }
    elif name == "query_source_code":
        topic = arguments.get("topic")
        if not topic:
            return {"error": "缺少 topic 参数"}, None
        result = query_source_code(run_id, topic)
        evidence = {
            "type": "source_code",
            "visible_to": ["dev"],
            "source": "query_source_code",
            **result,
        }
    else:
        return {"error": f"未知工具：{name}"}, None

    if not result or (name == "query_source_code" and not result.get("file")):
        return {"found": False, "result": result}, None

    evidence = append_tool_evidence(run_id, evidence)
    return {"found": True, "evidence_id": evidence["evidence_id"], "result": result}, evidence


def build_evidence(raw_event, static_index=None):
    """将原始事件转换成模型可引用的标准证据列表。

    关键帧会成为 ``runtime`` 证据，参数快照会成为 ``parameter`` 证据。
    每一条证据都会分配 E-01、E-02 这样的编号，供模型在回答中引用。
    """
    evidence = []
    static_index = static_index or {}
    seen_source_locations = set()

    def add_evidence(item):
        """为一条证据补上按顺序递增的 ID，再添加到结果列表。"""
        item["evidence_id"] = f"E-{len(evidence) + 1:02d}"
        evidence.append(item)

    # get 的默认值 {} 能处理原始事件中缺少 window 的情况。
    window = raw_event.get("window", {})
    for window_name, frames in window.items():
        # 不符合预期格式的数据直接跳过，避免一个坏字段导致整个任务失败。
        if not isinstance(frames, list):
            continue

        for frame in frames:
            if not isinstance(frame, dict):
                continue
            topic = frame.get("topic", "unknown")
            # 保留窗口名、主题、时间和数据；缺省字段也有安全默认值。
            add_evidence(
                {
                    "type": "runtime",
                    "visible_to": ["dev", "test", "ops"],
                    "window": window_name,
                    "topic": topic,
                    "timestamp": frame.get("timestamp"),
                    "data": frame.get("data", {}),
                }
            )

            mapping = static_index.get(topic, {})
            publisher = mapping.get("publisher", {}) if isinstance(mapping, dict) else {}
            file_path = publisher.get("file") if isinstance(publisher, dict) else None
            line = publisher.get("line") if isinstance(publisher, dict) else None
            location = (file_path, line)
            if file_path and line is not None and location not in seen_source_locations:
                seen_source_locations.add(location)
                add_evidence(
                    {
                        "type": "source_code",
                        "visible_to": ["dev"],
                        "topic": topic,
                        "node": publisher.get("node"),
                        "file": file_path,
                        "line": line,
                        "snippet": publisher.get("snippet", ""),
                    }
                )

    params_snapshot = raw_event.get("params_snapshot", {})
    # 排序可让同样的输入每次产生相同的证据顺序，便于测试与定位问题。
    for name in sorted(params_snapshot):
        add_evidence(
            {
                "type": "parameter",
                "visible_to": ["dev", "test"],
                "name": name,
                "value": params_snapshot[name],
            }
        )

    return evidence


def build_evidence_for_run(run_id):
    """在后台为指定任务构建证据，并更新其状态与进度文字。

    该函数由 FastAPI 的 BackgroundTasks 调用，因此接口可以先快速响应，
    耗时较长的整理工作则在响应发送后执行。
    """
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT raw_event_json FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
        # 任务不存在、或没有原始事件时无需处理，直接结束函数。
        if row is None or not row["raw_event_json"]:
            return False

        raw_event = json.loads(row["raw_event_json"])
        if not raw_event.get("params_snapshot"):
            raw_event["params_snapshot"] = get_params_snapshot_at(
                raw_event["trigger_time"]
            )
        static_index = get_static_index(raw_event.get("static_index_version"))
        evidence = build_evidence(raw_event, static_index)
        # 有至少一条证据才进入下一阶段；否则标记为失败并说明原因。
        if evidence:
            status = "reasoning"
            progress = "证据构建完成，等待 LLM 推理"
        else:
            status = "failed"
            progress = "事件中没有可用的运行时或参数证据"

        connection.execute(
            """
            UPDATE runs
            SET evidence_json = ?, status = ?, progress = ?
            WHERE run_id = ?
            """,
            (json.dumps(evidence, ensure_ascii=False), status, progress, run_id),
        )
        connection.commit()
    finally:
        connection.close()

    return bool(evidence)


def reason_run(run_id):
    """读取已构建的证据，调用 LLM 并保存最终校验结果。"""
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT evidence_type, evidence_json FROM runs WHERE run_id = ?",
            (run_id,),
        ).fetchone()
        if row is None:
            return

        evidence_data = {
            "evidence_type": row["evidence_type"],
            "evidence": json.loads(row["evidence_json"]),
        }
        connection.execute(
            "UPDATE runs SET progress = ? WHERE run_id = ?",
            ("正在调用 DeepSeek 生成结论", run_id),
        )
        connection.commit()
    finally:
        connection.close()

    try:
        output, errors, valid_evidence_ids = reason_with_verification(
            evidence_data, run_id
        )
    except Exception as exc:
        output = ""
        errors = [f"LLM 推理失败：{exc}"]
        valid_evidence_ids = collect_evidence_ids(evidence_data)

    verified = not errors
    connection = get_connection()
    try:
        connection.execute(
            """
            UPDATE runs
            SET status = ?, progress = ?, output = ?, verified = ?,
                errors_json = ?, valid_evidence_ids_json = ?
            WHERE run_id = ?
            """,
            (
                "done" if verified else "failed",
                "推理完成" if verified else "推理或证据校验失败",
                output,
                verified,
                json.dumps(errors, ensure_ascii=False),
                json.dumps(sorted(valid_evidence_ids), ensure_ascii=False),
                run_id,
            ),
        )
        connection.commit()
    finally:
        connection.close()


def process_run(run_id):
    """执行事件处理主链路：构建证据，再进行 LLM 推理。"""
    if build_evidence_for_run(run_id):
        reason_run(run_id)


def row_to_run(row, include_details=False):
    """把一行 SQLite 查询结果转换为适合 API 返回的字典。

    列表接口只需要摘要；详情接口通过 ``include_details=True`` 返回证据、
    模型输出和校验错误。这样可减少列表接口的返回体积。
    """
    run = {
        "run_id": row["run_id"],
        "evidence_type": row["evidence_type"],
        "trigger_time": row["trigger_time"],
        "robot_id": row["robot_id"],
        "status": row["status"],
        "progress": row["progress"],
        # SQLite 使用 0/1 保存布尔值，这里转回 JSON 的 true/false。
        "verified": bool(row["verified"]),
        "created_at": row["created_at"],
    }
    if include_details:
        run.update(
            {
                "evidence": json.loads(row["evidence_json"]),
                "output": row["output"],
                "errors": json.loads(row["errors_json"]),
                "valid_evidence_ids": json.loads(row["valid_evidence_ids_json"]),
            }
        )
        if row["raw_event_json"]:
            run["raw_event"] = json.loads(row["raw_event_json"])
    return run


def build_prompt(evidence_data):
    """根据证据构建发给大语言模型的提示词（prompt）。

    三行固定输出及证据引用规则会被 ``verify_output`` 再次检查；提示词是
    “希望模型遵守的约定”，校验函数才是程序实际执行的把关步骤。
    """
    return f"""
你是 Tracero 的机器人故障分析助手。

请只基于下面的 evidence 做分析，不要编造没有证据支持的信息。
输出必须包含三行：
【事实】...
【推理】...
【建议】...

重要规则：
1. 每一行结论都必须引用至少一个 evidence_id，例如 [E-01]。
2. 如果证据不足，要明确说“证据不足”，但仍然引用相关 evidence_id。
3. 不要输出 Markdown 表格。

evidence:
{json.dumps(evidence_data, ensure_ascii=False, indent=2)}
""".strip()


def call_deepseek_messages(messages, tools=None, model="deepseek-chat"):
    """调用 DeepSeek，并返回原始 assistant message（含可能的 tool_calls）。"""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("没有找到环境变量 DEEPSEEK_API_KEY")

    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }
    if tools:
        payload["tools"] = tools

    # 构造 HTTP POST 请求：JSON 请求体 + 内容类型 + Bearer 身份认证。
    request = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        # timeout=60 表示最多等待 60 秒，防止网络卡住时一直占用请求。
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DeepSeek API 请求失败：{exc.code} {error_body}") from exc

    return body["choices"][0]["message"]


def call_deepseek(prompt, model="deepseek-chat"):
    """普通单轮调用：只返回 DeepSeek 生成的文本。"""
    message = call_deepseek_messages(
        [
            {
                "role": "system",
                "content": "你是一个严格基于证据回答的机器人故障分析助手。",
            },
            {"role": "user", "content": prompt},
        ],
        model=model,
    )
    return message.get("content", "")


def collect_evidence_ids(evidence_data):
    """从输入证据中收集所有合法 ID，供回答校验时使用。"""
    evidence_ids = set()
    for item in evidence_data.get("evidence", []):
        evidence_id = item.get("evidence_id")
        if evidence_id:
            evidence_ids.add(evidence_id)
    return evidence_ids


def verify_output(output, valid_evidence_ids):
    """检查模型回答是否满足三段格式，且只引用真实存在的证据。

    返回错误信息列表而不是直接抛异常：这样调用方仍能保存模型原始回答，
    前端也可以向使用者展示具体哪里不符合约定。
    """
    errors = []
    # 每个部分必须以自己的独立行开头。
    required_sections = ["【事实】", "【推理】", "【建议】"]

    for section in required_sections:
        # 只寻找以目标标题开头的非空行；取第一行作为该部分的结论。
        matching_lines = [
            line.strip()
            for line in output.splitlines()
            if line.strip().startswith(section)
        ]

        if not matching_lines:
            errors.append(f"缺少 {section} 这一行")
            continue

        line = matching_lines[0]
        # 正则会从 [E-01] 这类文本中提取 E-01；set 会自动去重。
        cited_ids = set(re.findall(r"\[(E-\d+)\]", line))

        if not cited_ids:
            errors.append(f"{section} 没有引用 evidence_id")
            continue

        # 集合相减：模型引用过、但输入中不存在的编号就是无效引用。
        unknown_ids = cited_ids - valid_evidence_ids
        if unknown_ids:
            errors.append(
                f"{section} 引用了不存在的 evidence_id: {', '.join(sorted(unknown_ids))}"
            )

    return errors


def build_retry_prompt(evidence_data, previous_output, errors, valid_evidence_ids):
    """根据 Verifier 的具体错误，要求模型只纠正格式和证据引用。"""
    return f"""
你刚才的回答没有通过机械校验，请重新回答。

校验错误：
{json.dumps(errors, ensure_ascii=False)}

只能引用以下 evidence_id：
{", ".join(sorted(valid_evidence_ids))}

输出必须且只能包含三行：
【事实】... [E-xx]
【推理】... [E-xx]
【建议】... [E-xx]

原始证据：
{json.dumps(evidence_data, ensure_ascii=False, indent=2)}

上一次回答：
{previous_output}
""".strip()


def run_agent_loop(run_id, evidence_data):
    """让模型按需查询工具，最多进行三轮工具调用。"""
    messages = [
        {
            "role": "system",
            "content": (
                "你是严格基于证据回答的机器人故障分析助手。"
                "证据不足时可调用工具；工具结果中的 evidence_id 可以在最终结论中引用。"
            ),
        },
        {"role": "user", "content": build_prompt(evidence_data)},
    ]

    for _ in range(3):
        message = call_deepseek_messages(messages, tools=AGENT_TOOLS)
        tool_calls = message.get("tool_calls") or []
        if not tool_calls:
            return message.get("content", "")

        messages.append(
            {
                "role": "assistant",
                "content": message.get("content"),
                "tool_calls": tool_calls,
            }
        )
        for tool_call in tool_calls:
            function = tool_call.get("function", {})
            try:
                arguments = json.loads(function.get("arguments", "{}"))
                result, evidence = execute_agent_tool(
                    run_id, function.get("name", ""), arguments
                )
            except (TypeError, ValueError) as exc:
                result, evidence = {"error": f"工具参数错误：{exc}"}, None

            if evidence:
                evidence_data["evidence"].append(evidence)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": json.dumps(result, ensure_ascii=False),
                }
            )

    messages.append(
        {
            "role": "user",
            "content": "工具查询已达到三轮上限。请仅基于已有证据输出最终三行结论。",
        }
    )
    return call_deepseek_messages(messages).get("content", "")


def reason_with_verification(evidence_data, run_id=None):
    """调用模型并校验；首次不合格时只重试一次。"""
    output = (
        run_agent_loop(run_id, evidence_data)
        if run_id is not None
        else call_deepseek(build_prompt(evidence_data))
    )
    valid_evidence_ids = collect_evidence_ids(evidence_data)
    errors = verify_output(output, valid_evidence_ids)

    if errors:
        output = call_deepseek(
            build_retry_prompt(evidence_data, output, errors, valid_evidence_ids)
        )
        errors = verify_output(output, valid_evidence_ids)

    return output, errors, valid_evidence_ids


@app.on_event("startup")
def startup():
    """FastAPI 启动完成前执行：保证数据库表已经准备好。"""
    init_database()


@app.get("/api/health")
def health():
    """健康检查接口；部署平台可通过它确认服务正在运行。"""
    return {"status": "ok"}


@app.post("/api/ingest/static_index")
def ingest_static_index(static_index: StaticIndexIngestRequest):
    """接收 A 的源码映射，供事件证据构建时查询。"""
    created_at = save_static_index(static_index)
    return {
        "version": static_index.version,
        "status": "stored",
        "created_at": created_at,
    }


@app.post("/api/ingest/params")
def ingest_params(snapshot: ParamsSnapshotIngestRequest):
    """接收 A 在启动时推送的参数快照。"""
    created_at = save_params_snapshot(snapshot)
    return {"status": "stored", "created_at": created_at}


@app.post("/api/ingest/event")
def ingest_event(event: EventIngestRequest, background_tasks: BackgroundTasks):
    """接收 A 的异常切片，先落库，再异步构建证据。

    ``background_tasks`` 不会另起独立服务器进程；它会在当前请求响应返回后
    执行指定函数。前端可通过状态接口轮询证据构建是否完成。
    """
    run_id, created_at = create_received_run(event)
    # 把函数和它的参数登记为后台任务，而不是在此处直接执行。
    background_tasks.add_task(process_run, run_id)
    return {
        "run_id": run_id,
        "status": "received",
        "created_at": created_at,
    }


@app.get("/api/runs")
def list_runs():
    """返回所有任务的摘要列表，按创建时间从新到旧排列。"""
    connection = get_connection()
    try:
        rows = connection.execute(
            "SELECT * FROM runs ORDER BY created_at DESC"
        ).fetchall()
    finally:
        connection.close()

    # 列表页只转换摘要，不返回可能很大的原始事件与模型输出。
    return {"runs": [row_to_run(row) for row in rows]}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    """按任务 ID 返回完整详情：原始事件、证据、回答和校验结果。"""
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT * FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
    finally:
        connection.close()

    # 没查到记录时，使用 HTTP 404（资源不存在）而不是返回空对象。
    if row is None:
        raise HTTPException(status_code=404, detail="找不到这条分析记录")

    return row_to_run(row, include_details=True)


@app.get("/api/runs/{run_id}/status")
def get_run_status(run_id: str):
    """仅返回任务状态和进度，适合前端频繁轮询。"""
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT status, progress FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
    finally:
        connection.close()

    if row is None:
        raise HTTPException(status_code=404, detail="找不到这条分析记录")

    return {"status": row["status"], "progress": row["progress"]}


@app.post("/api/debug/reason")
def reason(request: ReasonRequest):
    """调试接口：直接用请求中的证据调用模型，并保存校验后的结果。

    流程：请求数据 -> 构造提示词 -> 调用 DeepSeek -> 校验引用 -> 保存 -> 返回。
    """
    # 将 Pydantic 请求模型转为普通字典，供后续函数统一使用。
    mock_data = request.dict()
    output, errors, valid_evidence_ids = reason_with_verification(mock_data)
    run_id, created_at, verified = save_run(
        mock_data, output, errors, valid_evidence_ids
    )

    return {
        "run_id": run_id,
        "output": output,
        "status": "completed" if verified else "verification_failed",
        "verified": verified,
        "errors": errors,
        "valid_evidence_ids": sorted(valid_evidence_ids),
        "created_at": created_at,
    }
