import json
import os
import re
import sqlite3
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


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
    evidence_type: str
    evidence: list[dict]


class EventIngestRequest(BaseModel):
    """A 同学的 Agent 在检测到异常后发送的事件切片。"""

    event_type: str
    trigger_time: float
    robot_id: str
    window: dict
    params_snapshot: dict = Field(default_factory=dict)
    static_index_version: Optional[str] = None


def get_connection():
    """每次使用数据库时新建一个连接，使用完后由调用方关闭。"""
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_database():
    """第一次启动服务时创建 runs 表；表已经存在时不会影响旧数据。"""
    connection = get_connection()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                evidence_type TEXT NOT NULL,
                trigger_time REAL,
                robot_id TEXT,
                status TEXT NOT NULL,
                progress TEXT,
                raw_event_json TEXT,
                evidence_json TEXT NOT NULL,
                output TEXT NOT NULL,
                verified INTEGER NOT NULL,
                errors_json TEXT NOT NULL,
                valid_evidence_ids_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        ensure_runs_columns(connection)
        connection.commit()
    finally:
        connection.close()


def ensure_runs_columns(connection):
    """为已经创建过的旧 runs 表补充事件接收阶段所需的列。"""
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
    """生成一次诊断任务的唯一编号。"""
    return f"run-{uuid.uuid4().hex[:8]}"


def save_run(mock_data, output, errors, valid_evidence_ids):
    """把一次 AI 分析的输入、输出和校验结果保存到 SQLite。"""
    run_id = new_run_id()
    created_at = datetime.now(timezone.utc).isoformat()
    verified = len(errors) == 0

    connection = get_connection()
    try:
        connection.execute(
            """
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
    """保存 A 推送的原始事件，并创建一个等待推理的 run。"""
    run_id = new_run_id()
    created_at = datetime.now(timezone.utc).isoformat()
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


def row_to_run(row, include_details=False):
    """把 SQLite 里的一行数据转换成 API 返回的 JSON。"""
    run = {
        "run_id": row["run_id"],
        "evidence_type": row["evidence_type"],
        "trigger_time": row["trigger_time"],
        "robot_id": row["robot_id"],
        "status": row["status"],
        "progress": row["progress"],
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


def build_prompt(mock_data):
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

mock evidence:
{json.dumps(mock_data, ensure_ascii=False, indent=2)}
""".strip()


def call_deepseek(prompt, model="deepseek-chat"):
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("没有找到环境变量 DEEPSEEK_API_KEY")

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": "你是一个严格基于证据回答的机器人故障分析助手。",
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }

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
        with urllib.request.urlopen(request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"DeepSeek API 请求失败：{exc.code} {error_body}") from exc

    return body["choices"][0]["message"]["content"]


def collect_evidence_ids(mock_data):
    evidence_ids = set()
    for item in mock_data.get("evidence", []):
        evidence_id = item.get("evidence_id")
        if evidence_id:
            evidence_ids.add(evidence_id)
    return evidence_ids


def verify_output(output, valid_evidence_ids):
    errors = []
    required_sections = ["【事实】", "【推理】", "【建议】"]

    for section in required_sections:
        matching_lines = [
            line.strip()
            for line in output.splitlines()
            if line.strip().startswith(section)
        ]

        if not matching_lines:
            errors.append(f"缺少 {section} 这一行")
            continue

        line = matching_lines[0]
        cited_ids = set(re.findall(r"\[(E-\d+)\]", line))

        if not cited_ids:
            errors.append(f"{section} 没有引用 evidence_id")
            continue

        unknown_ids = cited_ids - valid_evidence_ids
        if unknown_ids:
            errors.append(
                f"{section} 引用了不存在的 evidence_id: {', '.join(sorted(unknown_ids))}"
            )

    return errors


@app.on_event("startup")
def startup():
    init_database()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/ingest/event")
def ingest_event(event: EventIngestRequest):
    """接收 A 的异常切片，先落盘，后续由推理步骤消费。"""
    run_id, created_at = create_received_run(event)
    return {
        "run_id": run_id,
        "status": "received",
        "created_at": created_at,
    }


@app.get("/api/runs")
def list_runs():
    """查看所有已经保存的 AI 分析记录。"""
    connection = get_connection()
    try:
        rows = connection.execute(
            "SELECT * FROM runs ORDER BY created_at DESC"
        ).fetchall()
    finally:
        connection.close()

    return {"runs": [row_to_run(row) for row in rows]}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    """按编号查看某一条分析记录的完整证据、回答和校验结果。"""
    connection = get_connection()
    try:
        row = connection.execute(
            "SELECT * FROM runs WHERE run_id = ?", (run_id,)
        ).fetchone()
    finally:
        connection.close()

    if row is None:
        raise HTTPException(status_code=404, detail="找不到这条分析记录")

    return row_to_run(row, include_details=True)


@app.get("/api/runs/{run_id}/status")
def get_run_status(run_id: str):
    """供后续推理任务和前端轮询当前进度。"""
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
    mock_data = request.dict()
    prompt = build_prompt(mock_data)
    output = call_deepseek(prompt)
    valid_evidence_ids = collect_evidence_ids(mock_data)
    errors = verify_output(output, valid_evidence_ids)
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
