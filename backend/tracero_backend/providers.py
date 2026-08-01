import json
import os
import re
from abc import ABC, abstractmethod


EVIDENCE_ID_PATTERN = re.compile(r"^E-\d+$")


class ProviderError(RuntimeError):
    def __init__(self, error_code, message):
        super().__init__(message)
        self.error_code = error_code
        self.message = message


class EvidenceProvider(ABC):
    provider_type = "unknown"

    @abstractmethod
    def collect(self, request):
        """Return a normalized evidence package for one reasoning request."""


class DemoEvidenceProvider(EvidenceProvider):
    provider_type = "demo"

    def __init__(self, fixture_path=None):
        self.fixture_path = fixture_path or os.path.join(
            os.path.dirname(__file__), "demo_evidence.json"
        )

    def collect(self, request):
        try:
            with open(self.fixture_path, "r", encoding="utf-8") as fixture_file:
                fixtures = json.load(fixture_file)
        except (OSError, json.JSONDecodeError) as exc:
            raise ProviderError(
                "PROVIDER_UNAVAILABLE", f"Demo Evidence Provider 读取失败：{exc}"
            ) from exc

        trigger_type = request["trigger_type"]
        fixture = fixtures.get(trigger_type)
        if fixture is None:
            raise ProviderError(
                "EVIDENCE_NOT_FOUND",
                f"Demo Evidence Provider 没有 {trigger_type} 对应的证据",
            )

        evidence = []
        for item in fixture.get("evidence", []):
            normalized = dict(item)
            normalized["occurred_at"] = request["occurred_at"]
            if normalized.get("type") in {"user_question", "follow_up_question"}:
                normalized["content"] = request.get("question") or normalized["content"]
            if normalized.get("type") == "run_context" and request.get("run_id"):
                normalized["content"] = f"关联推理记录：{request['run_id']}"
            evidence.append(normalized)

        validate_evidence(evidence)
        if not evidence:
            raise ProviderError("EVIDENCE_NOT_FOUND", "DataProvider 没有返回任何证据")

        return {
            "trigger_type": trigger_type,
            "event_type": fixture["event_type"],
            "evidence_type": fixture["evidence_type"],
            "provider_type": self.provider_type,
            "data_source": self.provider_type,
            "evidence": evidence,
        }


class RobotEvidenceProvider(EvidenceProvider):
    provider_type = "robot"

    def collect(self, request):
        raise ProviderError(
            "PROVIDER_UNAVAILABLE",
            "RobotDataProvider 尚未配置真实机器人、ROS 或日志数据源",
        )


def validate_evidence(evidence):
    seen_ids = set()
    for item in evidence:
        evidence_id = item.get("evidence_id")
        if not evidence_id or not EVIDENCE_ID_PATTERN.fullmatch(evidence_id):
            raise ProviderError(
                "EVIDENCE_NOT_FOUND",
                f"证据编号不符合 E-01 格式：{evidence_id or '空值'}",
            )
        if evidence_id in seen_ids:
            raise ProviderError("EVIDENCE_NOT_FOUND", f"证据编号重复：{evidence_id}")
        seen_ids.add(evidence_id)

        for field in ("type", "content", "occurred_at"):
            if not item.get(field):
                raise ProviderError(
                    "EVIDENCE_NOT_FOUND",
                    f"证据 {evidence_id} 缺少字段：{field}",
                )


def get_evidence_provider():
    provider_name = os.environ.get("TRACERO_DATA_PROVIDER", "demo").strip().lower()
    if provider_name == "demo":
        return DemoEvidenceProvider()
    if provider_name == "robot":
        return RobotEvidenceProvider()
    raise ProviderError(
        "PROVIDER_UNAVAILABLE",
        f"不支持的 TRACERO_DATA_PROVIDER：{provider_name}",
    )
