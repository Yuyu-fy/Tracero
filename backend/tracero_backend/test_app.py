import os
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from fastapi import HTTPException

import app


VALID_OUTPUT = """【事实】Demo 证据显示地图更新延迟 [E-01]
【推理】控制器可能读取了过期地图 [E-02]
【建议】建议提高地图更新频率并执行回归验证 [E-04]"""


class TraceroBackendTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.original_database_path = app.DATABASE_PATH
        app.DATABASE_PATH = os.path.join(self.temp_dir.name, "tracero.db")
        os.environ["TRACERO_DATA_PROVIDER"] = "demo"
        app.init_database()

    def tearDown(self):
        app.DATABASE_PATH = self.original_database_path
        os.environ.pop("TRACERO_DATA_PROVIDER", None)
        self.temp_dir.cleanup()

    @patch.object(app, "call_deepseek", return_value=VALID_OUTPUT)
    def test_data_provider_reason_returns_structured_run(self, _mock_deepseek):
        request = app.ReasonTriggerRequest(
            trigger_type="navigation_failed",
            robot="robot_001",
            occurred_at="2026-08-01T09:00:00+08:00",
            context_window_seconds=5,
        )

        response = app.reason(request)

        self.assertTrue(response["verified"])
        self.assertEqual(response["data_source"], "demo")
        self.assertEqual(response["event_type"], "导航失败")
        self.assertEqual(
            response["conclusion"]["fact"],
            "Demo 证据显示地图更新延迟 [E-01]",
        )
        self.assertEqual(len(response["evidence"]), 4)

        saved = app.get_run(response["run_id"])
        self.assertEqual(saved["provider_type"], "demo")
        self.assertEqual(saved["conclusion"], response["conclusion"])

    @patch.object(app, "call_deepseek", return_value=VALID_OUTPUT)
    def test_debug_reason_keeps_direct_evidence_compatibility(self, _mock_deepseek):
        response = app.debug_reason(
            app.ReasonRequest(
                evidence_type="navigation_failed",
                evidence=[
                    {
                        "evidence_id": "E-01",
                        "type": "runtime",
                        "content": "地图更新延迟",
                    },
                    {
                        "evidence_id": "E-02",
                        "type": "source_code",
                        "content": "控制器读取地图",
                    },
                    {
                        "evidence_id": "E-04",
                        "type": "configuration",
                        "content": "update_frequency=5.0",
                    },
                ],
            )
        )

        self.assertEqual(response["provider_type"], "direct")
        self.assertTrue(all(item["occurred_at"] for item in response["evidence"]))

    def test_robot_provider_reports_explicit_unavailable_error(self):
        os.environ["TRACERO_DATA_PROVIDER"] = "robot"
        request = app.ReasonTriggerRequest(
            trigger_type="navigation_failed",
            robot="robot_001",
            occurred_at="2026-08-01T09:00:00+08:00",
            context_window_seconds=5,
        )

        with self.assertRaises(HTTPException) as raised:
            app.reason(request)

        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(
            raised.exception.detail["error_code"], "PROVIDER_UNAVAILABLE"
        )

    def test_database_migration_preserves_legacy_runs(self):
        legacy_path = app.DATABASE_PATH
        os.remove(legacy_path)
        connection = sqlite3.connect(legacy_path)
        connection.execute(
            """
            CREATE TABLE runs (
                run_id TEXT PRIMARY KEY,
                evidence_type TEXT NOT NULL,
                status TEXT NOT NULL,
                evidence_json TEXT NOT NULL,
                output TEXT NOT NULL,
                verified INTEGER NOT NULL,
                errors_json TEXT NOT NULL,
                valid_evidence_ids_json TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                "legacy-run",
                "navigation_failed",
                "completed",
                "[]",
                VALID_OUTPUT,
                1,
                "[]",
                '["E-01", "E-02", "E-04"]',
                "2026-07-30T00:00:00+00:00",
            ),
        )
        connection.commit()
        connection.close()

        app.init_database()
        migrated = app.get_run("legacy-run")

        self.assertEqual(migrated["data_source"], "legacy")
        self.assertEqual(migrated["conclusion"]["suggestion"], "建议提高地图更新频率并执行回归验证 [E-04]")


if __name__ == "__main__":
    unittest.main()
