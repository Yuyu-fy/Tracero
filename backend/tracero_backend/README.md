# Tracero Backend

## 启动

```powershell
pip install -r requirements.txt
$env:DEEPSEEK_API_KEY = "你的 DeepSeek Key"
$env:TRACERO_DATA_PROVIDER = "demo"
uvicorn app:app --host 0.0.0.0 --port 8000
```

开发联调默认使用 `DemoEvidenceProvider`。设置为 `robot` 时会启用 `RobotEvidenceProvider`；在真实机器人、ROS 或日志数据源尚未配置前，接口会返回 `PROVIDER_UNAVAILABLE`，不会回退到 Demo。

## 接口

- `GET /api/health`：健康检查。
- `GET /api/runs`：推理记录列表。
- `GET /api/runs/{run_id}`：完整推理记录。
- `POST /api/reason`：DataProvider 业务推理接口，只接收事件条件。
- `POST /api/debug/reason`：兼容的证据直传调试接口。

## 测试

```powershell
python -m unittest -v test_app.py
```

测试不访问 DeepSeek，覆盖 DemoDataProvider、结构化结论、直传接口兼容、RobotProvider 错误码和旧 SQLite 表迁移。
