# Tracero 前后端接口约定

复制 `.env.example` 为 `.env.local`。联调后端时设置：

```env
VITE_TRACERO_USE_MOCK=false
VITE_TRACERO_API_BASE_URL=http://127.0.0.1:8000/api
```

各接口路径均可通过对应环境变量覆盖。

## 当前推理

`GET /tracero/runs/current`

返回 `TraceroRun`，也兼容 `{ "data": TraceroRun }`。关键字段如下：

```json
{
  "run_id": "run_001",
  "event_type": "导航失败",
  "trigger_time": "14:32:07",
  "status": "reasoning",
  "robot": "robot_001",
  "timeline": [
    {
      "time": "14:32:08.770",
      "title": "局部代价地图延迟",
      "description": "costmap 更新延迟 340ms",
      "level": "critical"
    }
  ],
  "conclusion": {
    "fact": "已确认的事实",
    "reasoning": "推理过程摘要",
    "suggestion": "处理建议"
  }
}
```

当前总览和历史页面仍使用原有完整数据结构，因此联调阶段建议后端先按 `src/features/tracero/mock-data.ts` 中的 `currentRun` 结构返回。

## 发起推理

`POST /tracero/reasoning`

请求：

```json
{ "trigger": "manual", "event_id": "tc-01" }
```

响应为 `{ evidencePackage, run, conclusion, latency }`，也兼容包裹在 `data` 字段中。

## AI Chat

`POST /tracero/chat`

请求包含 `run_id`、本次 `message`、完整 `history` 和当前事件 `context`。响应支持以下任一字段：

```json
{ "content": "模型回复" }
```

也兼容 `answer`、`reply` 或 `{ "data": { "content": "模型回复" } }`。
