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

from providers import ProviderError, get_evidence_provider, validate_evidence


MODEL_REQUEST_FAILED = "MODEL_REQUEST_FAILED"
OUTPUT_VERIFICATION_FAILED = "OUTPUT_VERIFICATION_FAILED"
DATABASE_WRITE_FAILED = "DATABASE_WRITE_FAILED"

app = FastAPI(title="Tracero Backend")
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "tracero.db")


class ReasonRequest(BaseModel):
    """Compatibility contract for callers that already own complete evidence."""

    evidence_type: str
    evidence: list[dict]


class ReasonTriggerRequest(BaseModel):
    """Business contract: callers submit conditions, never provider evidence."""

    trigger_type: str
    robot: str
    occurred_at: str
    context_window_seconds: int = Field(default=300, ge=1, le=86400)
    question: Optional[str] = None
    run_id: Optional[str] = None
    history: list[dict] = Field(default_factory=list)
    context: dict = Field(default_factory=dict)


def model_to_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


MIGRATION_COLUMNS = {
    "trigger_type": "TEXT",
    "event_type": "TEXT",
    "provider_type": "TEXT",
    "data_source": "TEXT",
    "robot": "TEXT",
    "occurred_at": "TEXT",
    "context_window_seconds": "INTEGER",
    "question": "TEXT",
    "conclusion_json": "TEXT",
    "error_code": "TEXT",
}


def init_database():
    """Create the table and add new nullable columns without deleting old runs."""

    connection = get_connection()
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                evidence_type TEXT NOT NULL,
                status TEXT NOT NULL,
                evidence_json TEXT NOT NULL,
                output TEXT NOT NULL,
                verified INTEGER NOT NULL,
                errors_json TEXT NOT NULL,
                valid_evidence_ids_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                trigger_type TEXT,
                event_type TEXT,
                provider_type TEXT,
                data_source TEXT,
                robot TEXT,
                occurred_at TEXT,
                context_window_seconds INTEGER,
                question TEXT,
                conclusion_json TEXT,
                error_code TEXT
            )
            """
        )
        existing_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(runs)")
        }
        for column_name, column_type in MIGRATION_COLUMNS.items():
            if column_name not in existing_columns:
                connection.execute(
                    f"ALTER TABLE runs ADD COLUMN {column_name} {column_type}"
                )
        connection.commit()
    finally:
        connection.close()


def parse_conclusion(output):
    lines = [line.strip() for line in output.splitlines() if line.strip()]

    def read_section(section):
        prefix = f"【{section}】"
        for line in lines:
            if line.startswith(prefix):
                value = line[len(prefix) :].strip()
                return value or None
        return None

    fact = read_section("事实")
    reasoning = read_section("推理")
    suggestion = read_section("建议")
    if not fact or not reasoning or not suggestion:
        return None
    return {"fact": fact, "reasoning": reasoning, "suggestion": suggestion}


def save_run(record):
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    created_at = utc_now()
    connection = get_connection()
    try:
        connection.execute(
            """
            INSERT INTO runs (
                run_id, evidence_type, status, evidence_json, output,
                verified, errors_json, valid_evidence_ids_json, created_at,
                trigger_type, event_type, provider_type, data_source, robot,
                occurred_at, context_window_seconds, question,
                conclusion_json, error_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                record["evidence_type"],
                record["status"],
                json.dumps(record["evidence"], ensure_ascii=False),
                record["output"],
                record["verified"],
                json.dumps(record["errors"], ensure_ascii=False),
                json.dumps(record["valid_evidence_ids"], ensure_ascii=False),
                created_at,
                record["trigger_type"],
                record["event_type"],
                record["provider_type"],
                record["data_source"],
                record["robot"],
                record["occurred_at"],
                record.get("context_window_seconds"),
                record.get("question"),
                json.dumps(record["conclusion"], ensure_ascii=False)
                if record["conclusion"]
                else None,
                record.get("error_code"),
            ),
        )
        connection.commit()
    except sqlite3.Error as exc:
        raise HTTPException(
            status_code=500,
            detail={
                "error_code": DATABASE_WRITE_FAILED,
                "message": f"SQLite 写入失败：{exc}",
            },
        ) from exc
    finally:
        connection.close()
    return run_id, created_at


def row_value(row, key, default=None):
    if key not in row.keys() or row[key] is None:
        return default
    return row[key]


def load_json(value, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def event_type_for(evidence_type):
    return {
        "navigation_failed": "导航失败",
        "user_question": "用户提问事件",
        "follow_up_question": "推理追问事件",
    }.get(evidence_type, evidence_type)


def row_to_run(row, include_details=False):
    evidence_type = row["evidence_type"]
    output = row_value(row, "output", "")
    evidence = load_json(row_value(row, "evidence_json"), [])
    occurred_at = row_value(row, "occurred_at", row["created_at"])
    for item in evidence:
        item.setdefault("occurred_at", occurred_at)

    conclusion = load_json(row_value(row, "conclusion_json"), None)
    if conclusion is None:
        conclusion = parse_conclusion(output)

    run = {
        "run_id": row["run_id"],
        "trigger_type": row_value(row, "trigger_type", evidence_type),
        "event_type": row_value(row, "event_type", event_type_for(evidence_type)),
        "evidence_type": evidence_type,
        "provider_type": row_value(row, "provider_type", "legacy"),
        "data_source": row_value(row, "data_source", "legacy"),
        "robot": row_value(row, "robot", "robot_001"),
        "occurred_at": occurred_at,
        "context_window_seconds": row_value(row, "context_window_seconds"),
        "question": row_value(row, "question"),
        "status": row["status"],
        "verified": bool(row["verified"]),
        "conclusion": conclusion,
        "errors": load_json(row_value(row, "errors_json"), []),
        "error_code": row_value(
            row,
            "error_code",
            None if bool(row["verified"]) else OUTPUT_VERIFICATION_FAILED,
        ),
        "valid_evidence_ids": load_json(
            row_value(row, "valid_evidence_ids_json"), []
        ),
        "created_at": row["created_at"],
    }
    if include_details:
        run.update({"evidence": evidence, "output": output})
    return run


def build_prompt(evidence_package):
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

evidence package:
{json.dumps(evidence_package, ensure_ascii=False, indent=2)}
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
    api_request = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(api_request, timeout=60) as response:
            body = json.loads(response.read().decode("utf-8"))
        return body["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"DeepSeek API 请求失败：{exc.code} {error_body}"
        ) from exc
    except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"DeepSeek API 响应失败：{exc}") from exc


def collect_evidence_ids(evidence_package):
    return {
        item["evidence_id"]
        for item in evidence_package.get("evidence", [])
        if item.get("evidence_id")
    }


def verify_output(output, valid_evidence_ids):
    errors = []
    for section in ("【事实】", "【推理】", "【建议】"):
        matching_lines = [
            line.strip()
            for line in output.splitlines()
            if line.strip().startswith(section)
        ]
        if not matching_lines:
            errors.append(f"缺少 {section} 这一行")
            continue

        cited_ids = set(re.findall(r"\[(E-\d+)\]", matching_lines[0]))
        if not cited_ids:
            errors.append(f"{section} 没有引用 evidence_id")
            continue
        unknown_ids = cited_ids - valid_evidence_ids
        if unknown_ids:
            errors.append(
                f"{section} 引用了不存在的 evidence_id: "
                f"{', '.join(sorted(unknown_ids))}"
            )
    return errors


def normalize_direct_evidence(request_data, occurred_at):
    evidence = []
    for item in request_data.get("evidence", []):
        normalized = dict(item)
        normalized.setdefault("occurred_at", occurred_at)
        evidence.append(normalized)
    if not evidence:
        raise ProviderError("EVIDENCE_NOT_FOUND", "请求没有提供任何证据")
    validate_evidence(evidence)
    return evidence


def execute_reasoning(evidence_package, metadata):
    valid_evidence_ids = collect_evidence_ids(evidence_package)
    try:
        output = call_deepseek(build_prompt(evidence_package))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail={"error_code": MODEL_REQUEST_FAILED, "message": str(exc)},
        ) from exc

    errors = verify_output(output, valid_evidence_ids)
    conclusion = parse_conclusion(output)
    if conclusion is None and not errors:
        errors.append("推理输出无法解析为结构化 conclusion")
    verified = len(errors) == 0 and conclusion is not None
    error_code = None if verified else OUTPUT_VERIFICATION_FAILED
    record = {
        **metadata,
        "evidence_type": evidence_package["evidence_type"],
        "provider_type": evidence_package["provider_type"],
        "data_source": evidence_package["data_source"],
        "evidence": evidence_package["evidence"],
        "output": output,
        "conclusion": conclusion,
        "status": "completed" if verified else "verification_failed",
        "verified": verified,
        "errors": errors,
        "error_code": error_code,
        "valid_evidence_ids": sorted(valid_evidence_ids),
    }
    run_id, created_at = save_run(record)
    return {
        "run_id": run_id,
        "trigger_type": record["trigger_type"],
        "event_type": record["event_type"],
        "evidence_type": record["evidence_type"],
        "provider_type": record["provider_type"],
        "data_source": record["data_source"],
        "robot": record["robot"],
        "occurred_at": record["occurred_at"],
        "context_window_seconds": record.get("context_window_seconds"),
        "question": record.get("question"),
        "status": record["status"],
        "verified": verified,
        "conclusion": conclusion,
        "evidence": record["evidence"],
        "output": output,
        "errors": errors,
        "error_code": error_code,
        "valid_evidence_ids": record["valid_evidence_ids"],
        "created_at": created_at,
    }


@app.on_event("startup")
def startup():
    init_database()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/runs")
def list_runs():
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


@app.post("/api/debug/reason")
def debug_reason(request: ReasonRequest):
    request_data = model_to_dict(request)
    occurred_at = utc_now()
    try:
        evidence = normalize_direct_evidence(request_data, occurred_at)
    except ProviderError as exc:
        raise HTTPException(
            status_code=422,
            detail={"error_code": exc.error_code, "message": exc.message},
        ) from exc

    evidence_type = request_data["evidence_type"]
    evidence_package = {
        "evidence_type": evidence_type,
        "provider_type": "direct",
        "data_source": "direct",
        "evidence": evidence,
    }
    return execute_reasoning(
        evidence_package,
        {
            "trigger_type": evidence_type,
            "event_type": event_type_for(evidence_type),
            "robot": "unknown",
            "occurred_at": occurred_at,
            "context_window_seconds": None,
            "question": None,
        },
    )


@app.post("/api/reason")
def reason(request: ReasonTriggerRequest):
    request_data = model_to_dict(request)
    try:
        provider = get_evidence_provider()
        evidence_package = provider.collect(request_data)
    except ProviderError as exc:
        status_code = 422 if exc.error_code == "EVIDENCE_NOT_FOUND" else 503
        raise HTTPException(
            status_code=status_code,
            detail={"error_code": exc.error_code, "message": exc.message},
        ) from exc

    return execute_reasoning(
        evidence_package,
        {
            "trigger_type": request_data["trigger_type"],
            "event_type": evidence_package["event_type"],
            "robot": request_data["robot"],
            "occurred_at": request_data["occurred_at"],
            "context_window_seconds": request_data["context_window_seconds"],
            "question": request_data.get("question"),
        },
    )
