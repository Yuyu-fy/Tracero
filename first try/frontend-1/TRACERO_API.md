# Tracero 前后端接口约定

复制 `.env.example` 为 `.env.local`。联调后端时设置：

```env
VITE_TRACERO_USE_MOCK=false
VITE_TRACERO_API_BASE_URL=http://127.0.0.1:8000
VITE_TRACERO_REASONING_PATH=/api/reason
VITE_TRACERO_RUNS_PATH=/api/runs
```

各接口路径均可通过对应环境变量覆盖。

## 获取最新推理

前端先请求 `GET /api/runs`，取列表中的第一条记录，再请求：

```text
GET /api/runs/{run_id}
```

详情响应直接包含 `conclusion`、`evidence`、`provider_type`、`data_source`、`status`、`verified`、`errors`、`error_code`、`valid_evidence_ids` 及时间字段。前端直接展示结构化 `conclusion`，并将 `data_source` 显示为本次运行的数据来源。

后端尚未返回完整时间线和角色分析数据，因此当前联调阶段仍使用 `src/features/tracero/mock-data.ts` 中的 `mockCurrentRun` 补齐页面骨架。

## 发起 TC-01 推理

`POST /api/reason`

请求：

```json
{
  "evidence_type": "navigation_failed",
  "evidence": [
    {
      "evidence_id": "E-01",
      "type": "metric",
      "content": "costmap 更新时间差……"
    }
  ]
}
```

响应：

```json
{
  "run_id": "run-abcd1234",
  "provider_type": "robot",
  "data_source": "robot",
  "conclusion": {
    "fact": "……[E-01]",
    "reasoning": "……[E-01]",
    "suggestion": "……[E-01]"
  },
  "status": "completed",
  "verified": true,
  "errors": [],
  "valid_evidence_ids": ["E-01"],
  "created_at": "2026-07-27T10:00:00+00:00"
}
```

## 用户提问与 AI Chat

前端目前保留以下预留路径：

```text
POST /tracero/reasoning/question
POST /tracero/chat
```

当前 FastAPI 后端尚未实现这两个接口，真实后端模式下暂不可用。
