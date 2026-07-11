# OpenCode + DeepSeek V4 分阶段体验指南
## 面向 Tracero 项目学生的完整操作文档

> **适用读者**：Tracero 项目 B 模块同学，对 Ubuntu 不一定熟悉
> **核心目标**：理解 OpenCode 架构 → 体验功能 → 具备修改 Bun 后端能力
> **两种环境**：Mac（arm64） / Windows 11 + WSL2（x64）

---

## 版本锁定说明

> ⚠️ **重要**：本文档锁定 OpenCode 版本为 **v1.14.41**。
>
> 文档撰写时验证版本为 v1.14.41（2026年5月7日）。使用前请确认该版本仍可从
> `ghcr.io/anomalyco/opencode:1.14.41` 拉取。如需使用更新版本，选择 v1.14.x
> 系列中最新的 patch 版本（如 v1.14.42、v1.14.43），避免跳到 v1.15.x 系列——
> v1.15.x 目前仍处于快速迭代阶段，每天多个版本，不适合教学文档锁定。
>
> OpenCode 项目每天发布 2 个左右版本，所有同学**必须使用同一版本**，否则
> `prompt.ts` 的函数名、文件结构可能不一致，无法对照排查问题。

---

## 目录

1. [OpenCode 架构解析](#1-opencode-架构解析)
2. [ARM 与 X64 体系结构辨析](#2-arm-与-x64-体系结构辨析)
3. [环境1 — MacBook（arm64，全新机器）](#3-环境1--macbook-arm64全新机器)
4. [环境2 — Windows 11 + WSL2 + Docker Desktop](#4-环境2--windows-11--wsl2--docker-desktop)
5. [附件](#5-附件)

---

## 1. OpenCode 架构解析

### 1.1 整体架构：三层分离

OpenCode 不是一个单体程序，而是 **client/server 架构**，分三层：

```
┌──────────────────────────────────────────────────────────┐
│                    客户端层（可选其一）                      │
│   TUI（终端界面）   Web UI   Desktop App   VS Code 插件    │
└─────────────────────────────┬────────────────────────────┘
                              │ HTTP + SSE
┌─────────────────────────────▼────────────────────────────┐
│               Bun 后端（核心，TypeScript）                  │
│   packages/opencode/src/                                  │
│   ├── session/prompt.ts   ← Agent Loop 在这里              │
│   ├── session/processor.ts                                │
│   ├── session/llm.ts      ← LLM 调用                      │
│   ├── provider/           ← 各 LLM 提供商适配器             │
│   └── server/             ← HTTP Server（Hono 框架）        │
└─────────────────────────────┬────────────────────────────┘
                              │ API 调用
┌─────────────────────────────▼────────────────────────────┐
│                     LLM Provider 层                        │
│   DeepSeek V4 / Claude / OpenAI / Ollama ...              │
└──────────────────────────────────────────────────────────┘
```

**关键理解**：
- **Bun 后端**是 OpenCode 的大脑，所有 AI 推理、工具调用、会话管理都在这里
- **TUI / Web UI / Desktop App** 只是展示层，通过 HTTP/SSE 连接到同一个 Bun 后端
- **运行 `opencode serve`** 时，只启动 Bun 后端，不启动任何 UI（headless 模式）
- **运行 `opencode`** 时，同时启动 Bun 后端 + TUI

### 1.2 三种前端界面详解

#### TUI（终端界面）

**技术栈**：opentui（OpenCode 团队自研的 TypeScript 终端 UI 框架，正在从 Go 迁移过来）

**外观**：在终端里显示的文字界面，支持键盘导航，有会话列表、代码高亮、工具调用展示等

**特点**：
- 无需浏览器，直接在终端里运行
- 适合 SSH 远程场景
- `docker run -it ghcr.io/anomalyco/opencode:1.14.41` 默认启动的就是 TUI

**启动命令**：
```bash
opencode                    # 在当前目录启动 TUI
opencode /path/to/project   # 在指定目录启动 TUI
```

#### Web UI

**技术栈**：SolidJS + Vite（注意：不是 React！）

**外观**：和 TUI 功能一致，但运行在浏览器里，有更好的代码高亮和鼠标支持

**特点**：
- 浏览器访问，界面更友好
- 和 TUI 共用同一个 Bun 后端，功能完全一致
- 适合在 Docker 容器里运行 Bun 后端，宿主机用浏览器访问
- 本文档阶段一体验主要用这个

**启动命令**：
```bash
opencode web                               # 启动后端 + 打开浏览器
opencode web --hostname 0.0.0.0 --port 4096  # 监听所有网络接口（Docker 内使用）
```

#### Desktop App

**技术栈**：Tauri 2（Rust 后端 + SolidJS 前端）

**外观**：原生桌面应用窗口，内嵌 Web UI，有系统通知、文件关联等原生特性

**特点**：
- macOS / Windows / Linux 均有安装包
- 内部运行一个 sidecar 进程（即 Bun 后端）
- 适合日常开发使用，安装后双击打开即可用

**下载**：`https://opencode.ai/download`

### 1.3 Tracero 能否复用 OpenCode 的前端？

**结论：不能直接复用，差距太大。**

下面是 Tracero 需要的 UI 和 OpenCode 现有前端之间的核心 GAP：

| UI 需求 | OpenCode 有什么 | Tracero 需要什么 | 能否复用 |
|---|---|---|---|
| 用户视角切换 | ❌ 无此概念 | 开发/测试/运营三视角，权限过滤 | 不能 |
| Evidence 面板 | ❌ 无此概念 | 每条结论带 evidence_id，点击展开源码+数据 | 不能 |
| 消息时间线 | ❌ 无此概念 | ROS2 topic 时序事件列表，带时间戳 | 不能 |
| AI 输出格式 | 流式文本+工具调用 | 严格三段式（事实/推理/建议），每句带角标 | 不能 |
| Bug 报告导出 | ❌ 无此功能 | 按视角生成 Markdown，粘进 Jira/飞书 | 不能 |
| 机器人实时状态 | ❌ 无此功能 | rosbridge WebSocket，/odom 位置速度显示 | 不能 |
| 事件列表页 | 会话列表 | 异常事件列表，含触发时间/类型/状态 | 结构相似但数据模型完全不同 |
| 代码片段展示 | 代码高亮 | 代码定位到文件名+行号，参数格式化 | 组件可参考但需重写 |

**更根本的原因**：OpenCode Web UI 用 **SolidJS**，Tracero Module C 计划用 **React**。两者框架不兼容，库生态也不一样（shadcn、antd 都是 React 专属）。

**正确的做法**：Tracero C 模块用 React + TypeScript 从头构建。可以把 OpenCode Web UI 的**视觉设计风格**（三栏布局、代码高亮、会话流）作为参考，但代码不能搬。

### 1.4 Bun 后端的 Agent Loop

Agent Loop 是整个推理引擎的核心，位于：

```
packages/opencode/src/session/prompt.ts
函数：SessionPrompt.loop() 或 runLoop()
```

**完整执行流程**（简化版）：

```
用户发送消息
    ↓
SessionPrompt.prompt()   ← 入口
    ↓
创建 UserMessage，加入会话历史
    ↓
┌─────────── loop() 主循环 ──────────┐
│                                    │
│  1. 加载会话消息历史                │
│  2. 解析可用工具（内置 + MCP）      │
│  3. 构建 system prompt             │
│  4. 调用 LLM.stream()             │  ← LLM 推理
│       ↓                           │
│  5. 处理 LLM 流式输出：            │
│     - text-delta → 写入文本        │
│     - tool-call  → 执行工具        │
│       ↓                           │
│  6. 判断终止条件：                 │
│     - finish="stop" → 退出 loop   │  ← 正常结束
│     - finish="tool-calls" → 继续  │  ← 还有工具调用
│     - compact → 压缩历史后继续     │
│                                   │
└───────────────────────────────────┘
    ↓
返回最终 AssistantMessage
```

### 1.5 Tracero 修改 Bun 循环的思路

Tracero 需要在推理时**注入运行时数据**（ROS2 消息时序、代码静态索引、参数快照），而不是仅凭代码推理。修改点在 `prompt.ts` 的 loop 函数内部。

**切入点1：在每次 LLM 调用前注入运行时上下文**

```typescript
// packages/opencode/src/session/prompt.ts
// 在 loop() 的 while(true) 内，LLM 调用前插入：

// ★ Tracero 新增：从外部数据源获取运行时证据
const runtimeEvidence = yield* fetchTraceroEvidence(sessionID)
if (runtimeEvidence) {
  messages.push({
    role: "user",
    content: `[运行时证据]\n${JSON.stringify(runtimeEvidence, null, 2)}`
  })
}

// 原有的 LLM 调用
yield* processor.process(streamInput)
```

**切入点2：在 LLM 返回结论后插入 Verifier**

```typescript
// 在 finish="stop" 分支，退出前校验
if (finished) {
  const conclusions = parseTraceroConclusions(handle.message.content)
  const { ok, missing } = traceroVerifier.check(conclusions)

  if (!ok) {
    // 校验失败 → 注入纠正 prompt，继续 loop
    messages.push({
      role: "user",
      content: `以下结论缺少 evidence_id：${JSON.stringify(missing)}，请补充引用`
    })
    continue
  }
  // 校验通过 → 正常退出
}
```

**切入点3（最小验证改动）**：先加一行 console.log 确认你找对了位置

```typescript
console.log("[Tracero] loop iteration started, sessionID:", sessionID)
```

### 1.6 DeepSeek V4 API Key 申请

**第一步**：访问 DeepSeek API 平台

```
https://platform.deepseek.com
```

**第二步**：注册账号，用邮箱或手机号注册，完成邮箱验证。

**第三步**：充值。进入"Top up"页面，充值最低额度（10 元人民币起，日常练习消费极少）。

**第四步**：创建 API Key

进入左侧菜单"API keys" → "Create new API key" → 取名 `tracero-dev` → 创建。

> ⚠️ **重要**：API Key 只显示一次，立刻复制保存。

**第五步**：记录 Key，格式如下：
```
sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

后续文档里 `YOUR_DEEPSEEK_API_KEY` 都替换成这个值。

### 1.7 opencode.jsonc 配置说明

OpenCode 的配置文件路径：

```
~/.config/opencode/opencode.jsonc
```

**DeepSeek V4 Pro 配置模板**：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "options": {
        "baseURL": "https://api.deepseek.com",
        "apiKey": "YOUR_DEEPSEEK_API_KEY"
      },
      "models": {
        "deepseek-v4-pro": {
          "name": "DeepSeek-V4-Pro",
          "limit": {
            "context": 1048576,
            "output": 262144
          },
          "reasoning": true
        }
      }
    }
  },
  "model": "deepseek/deepseek-v4-pro"
}
```

---

## 2. ARM 与 X64 体系结构辨析

> 本章解释为什么 Mac M 系列和 Windows x64 机器要用不同的 Docker image，以及这个区别在整个软件栈的每一层产生什么连锁影响。

### 2.1 什么是 CPU 架构

CPU 架构定义了处理器能理解的**指令集**（机器码的语言）。两种主要架构：

| 架构 | 别名 | 代表硬件 |
|---|---|---|
| **ARM64** | aarch64 | Mac M1/M2/M3/M4、树莓派、手机芯片 |
| **x86_64** | amd64、x64 | Intel/AMD 台式机、笔记本、服务器 |

**核心规则**：为 x64 编译的二进制文件，在 ARM 机器上**无法直接运行**，反之亦然。就像中文书不能用英文阅读习惯直接读一样，需要翻译（模拟器）或重新编译。

### 2.2 连锁影响：从 CPU 到每一个软件层

```
CPU 架构（ARM64 vs x64）
    │
    ▼ 影响
操作系统内核（Ubuntu arm64 vs Ubuntu amd64）
    │
    ├─ apt 下载的包：arm64 版 vs amd64 版
    ├─ C 标准库：同样是 glibc，但编译目标不同
    └─ 系统调用接口：兼容但指令集不同
    │
    ▼ 影响
Docker 引擎本身（跑在对应架构的 OS 上）
    │
    ▼ 影响
Docker Image（镜像）
    │
    ├─ 镜像里的二进制：必须和运行机器架构匹配
    ├─ Multi-arch manifest：一个 tag 下有多个 layer
    │   例如 ghcr.io/anomalyco/opencode:1.14.41
    │   ├── linux/amd64 layer（给 x64 机器）
    │   └── linux/arm64 layer（给 ARM 机器）
    └─ docker pull 时自动选择对应 layer
    │
    ▼ 影响
容器内的软件
    ├─ Alpine image：用 musl libc（轻量，小巧）
    │   OpenCode 官方 image 基于 Alpine
    │   二进制是 musl 编译的，不能复制到 Ubuntu/glibc 系统里跑
    └─ Ubuntu image：用 glibc（标准，兼容性好）
        我们的开发容器基于 Ubuntu 22.04
```

### 2.3 Mac M 系列的特殊情况

Mac M 芯片是 ARM64，但 Docker Desktop for Mac 有一个机制：

**Rosetta 2 模拟**：可以在 ARM Mac 上运行 x64 镜像，但速度慢（需要实时翻译指令）

本文档**不使用 Rosetta**，全部使用 ARM64 原生镜像，包括：
- Alpine ARM64：`ghcr.io/anomalyco/opencode:1.14.41`（自动选择 arm64 layer）
- Ubuntu 22.04 ARM64：`ubuntu:22.04`（自动选择 arm64 layer）

验证你拉到的是正确架构：

```bash
# Mac 上运行
docker inspect ghcr.io/anomalyco/opencode:1.14.41 \
    --format '{{.Architecture}}'
# 期望输出：arm64
```

### 2.4 Windows x64 的情况

Windows 11 x64 机器上，Docker Desktop 使用 WSL2 后端。WSL2 本质上是一个轻量 Linux 虚拟机，运行在 x64 CPU 上。

- 所有 Docker image 都使用 **amd64/x64 版本**
- 不需要 Rosetta，也不需要跨架构模拟
- Alpine amd64 layer 和 Ubuntu amd64 都直接原生运行

```bash
# Windows WSL2 里验证
docker inspect ghcr.io/anomalyco/opencode:1.14.41 \
    --format '{{.Architecture}}'
# 期望输出：amd64
```

### 2.5 Alpine 的 musl libc 问题

OpenCode 官方 image 基于 Alpine Linux，Alpine 使用 **musl libc**，而不是主流的 **glibc**。

**这意味着**：你无法把 OpenCode 官方 Alpine image 里的 `opencode` 二进制文件拷出来，放到 Ubuntu 容器里直接跑——因为它链接的是 musl 库，Ubuntu 里没有。

```
Alpine image（musl libc）
├── opencode 二进制  ← 链接 musl
└── 只能在 Alpine 环境里跑

Ubuntu image（glibc）
├── 我们 clone 的 TypeScript 源码
└── bun（链接 glibc）执行源码 ← 在 Ubuntu 里正常
```

**结论**：
- **阶段一体验**：用 Alpine image，直接跑官方预编译的 OpenCode 二进制
- **阶段二开发**：用 Ubuntu image，装 Bun，用 Bun 直接执行 TypeScript 源码

### 2.6 架构选择总结表

| 环境 | 机器架构 | 阶段一 image | 阶段二 image |
|---|---|---|---|
| MacBook M 系列 | arm64 | Alpine arm64 | Ubuntu 22.04 arm64 |
| Windows 11 x64 | amd64 | Alpine amd64 | Ubuntu 22.04 amd64 |

Docker 会根据宿主机架构**自动选择正确的 layer**，不需要手动指定 `--platform` 参数。

---

## 3. 环境1 — MacBook（arm64，全新机器）

> **前提**：Mac M1/M2/M3/M4，macOS 13 Ventura 及以上，没有安装过 Docker Desktop。

### 3.1 安装 Docker Desktop

**第一步**：下载 Docker Desktop

```
https://www.docker.com/products/docker-desktop/
```

点击"Download Docker Desktop" → 选择 **"Apple Silicon"** 版本。

**第二步**：安装

```
1. 双击下载好的 Docker.dmg 文件
2. 将 Docker 图标拖入 Applications 文件夹
3. 打开 Launchpad，找到 Docker，点击运行
4. 顶部菜单栏出现鲸鱼图标🐳，等待停止动画
5. 接受用户协议，点击"Accept"
```

**第三步**：验证

```bash
docker --version
# 期望：Docker version 27.x.x

docker run hello-world
# 期望：Hello from Docker!

uname -m
# 期望：arm64
```

### 3.2 Mac Host 如何访问 Docker 挂载目录

**重要理解**：Docker 的 volume 挂载（`-v 宿主机路径:容器路径`）本质上是把宿主机的某个目录**直接暴露**给容器。宿主机和容器共享同一份文件，不是拷贝。

**Mac 上**，挂载目录就是普通的 Mac 文件系统路径，可以用任何工具直接访问：

#### 方法1：Finder 访问

```
1. 打开 Finder
2. 菜单栏：前往 → 前往文件夹（Command + Shift + G）
3. 输入路径，例如：~/opencode-dev/src
4. 回车，Finder 直接打开该目录
```

#### 方法2：VS Code 直接打开（推荐修改源码时使用）

```bash
# 在 Mac 终端里
code ~/opencode-dev/src
```

或者在 VS Code 里：文件 → 打开文件夹 → 选择 `~/opencode-dev/src`

这样你就能在 Mac 本地用 VS Code 编辑源码，容器内的 Bun 进程实时看到改动。

#### 方法3：终端直接编辑

```bash
# Mac 终端里，直接编辑挂载的文件
nano ~/opencode-dev/src/packages/opencode/src/session/prompt.ts

# 或用 VS Code
code ~/opencode-dev/src/packages/opencode/src/session/prompt.ts
```

#### 实际工作流建议

**开发时推荐的分工**：

```
Mac 本机（VS Code）          Docker 容器（Bun 运行时）
─────────────────            ──────────────────────────
编辑源码文件                   执行 bun dev web
~/opencode-dev/src/    ←→    /root/opencode-src/
（同一份文件，实时同步）
```

这样不需要进入容器才能改代码，Mac 上的 VS Code 改完保存，容器里的 Bun 立刻看到变化。

---

### 3.3 阶段一：Alpine ARM image 体验 OpenCode（不修改源码）

#### 3.3.1 准备持久化目录

```bash
mkdir -p ~/opencode-data/share
mkdir -p ~/.config/opencode
mkdir -p ~/opencode-workspace
```

#### 3.3.2 写入 DeepSeek 配置

```bash
nano ~/.config/opencode/opencode.jsonc
```

粘贴以下内容（替换 API Key）：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "options": {
        "baseURL": "https://api.deepseek.com",
        "apiKey": "YOUR_DEEPSEEK_API_KEY"
      },
      "models": {
        "deepseek-v4-pro": {
          "name": "DeepSeek-V4-Pro",
          "limit": {
            "context": 1048576,
            "output": 262144
          },
          "reasoning": true
        }
      }
    }
  },
  "model": "deepseek/deepseek-v4-pro"
}
```

保存：`Ctrl+X` → `Y` → `Enter`

#### 3.3.3 拉取指定版本 Alpine ARM image

```bash
# 拉取锁定版本（自动选择 arm64 layer）
docker pull ghcr.io/anomalyco/opencode:1.14.41

# 验证拉取成功
docker images | grep opencode

# 确认是 arm64
docker inspect ghcr.io/anomalyco/opencode:1.14.41 \
    --format '{{.Architecture}}'
# 期望：arm64
```

#### 3.3.4 以 Web UI 模式启动

```bash
docker run -it \
  --name opencode-alpine \
  -p 4096:4096 \
  -v ~/.config/opencode:/root/.config/opencode \
  -v ~/opencode-data/share:/root/.local/share/opencode \
  -v ~/opencode-workspace:/workspace \
  -w /workspace \
  ghcr.io/anomalyco/opencode:1.14.41 \
  web --hostname 0.0.0.0 --port 4096
```

**参数说明**：

| 参数 | 作用 |
|---|---|
| `--name opencode-alpine` | 给容器命名 |
| `-p 4096:4096` | 端口映射，Mac 浏览器访问容器 |
| `-v ~/.config/opencode:...` | 挂载配置（含 DeepSeek Key），Mac 上可直接编辑 |
| `-v ~/opencode-data/share:...` | 挂载会话数据，容器重建后不丢失 |
| `-v ~/opencode-workspace:...` | 挂载工作目录，OpenCode 分析这里的代码 |
| `web --hostname 0.0.0.0` | Web UI 模式，监听所有网络接口 |

#### 3.3.5 浏览器访问

打开 Mac 浏览器，访问：`http://localhost:4096`

在对话框里输入：`你好，你是哪个模型？` 确认 DeepSeek 连接正常。

#### 3.3.6 配置文件的 Mac 本机修改方式

容器运行期间，如果需要修改 DeepSeek 配置：

```bash
# 直接在 Mac 终端修改（不需要进容器）
nano ~/.config/opencode/opencode.jsonc

# 或用 VS Code 打开
code ~/.config/opencode/opencode.jsonc
```

修改保存后，重启容器生效：

```bash
docker restart opencode-alpine
```

#### 3.3.7 日常操作命令

```bash
# 日常启动（不需要重新 docker run）
docker start opencode-alpine
# 此时 Web UI 在后台运行，浏览器访问 http://localhost:4096

# 停止
docker stop opencode-alpine

# 查看状态
docker ps -a | grep opencode
```

---

### 3.4 阶段二：Ubuntu 22.04 ARM 开发环境（可修改 Bun 后端）

#### 3.4.1 Fork OpenCode 仓库

打开浏览器访问 `https://github.com/anomalyco/opencode`，点击右上角 **Fork**。

记录你的 fork 地址：`https://github.com/你的GitHub用户名/opencode.git`

#### 3.4.2 创建工作目录和 Dockerfile

```bash
mkdir -p ~/opencode-dev/src
mkdir -p ~/opencode-dev

cd ~/opencode-dev

cat > Dockerfile << 'EOF'
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai

RUN apt-get update && apt-get install -y \
    curl wget git vim nano \
    build-essential cmake \
    ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

# 安装 Bun（TypeScript 构建和运行时）
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# 安装 Node.js（部分 npm 包需要）
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /root/opencode-src /root/.config/opencode

WORKDIR /root
CMD ["/bin/bash"]
EOF
```

#### 3.4.3 构建开发环境镜像

```bash
cd ~/opencode-dev

docker build -t opencode-dev-ubuntu22-arm .

# 验证
docker images | grep opencode-dev-ubuntu22-arm
```

#### 3.4.4 启动开发容器

```bash
docker run -it \
  --name opencode-dev \
  -v ~/opencode-dev/src:/root/opencode-src \
  -v ~/.config/opencode:/root/.config/opencode \
  -p 4096:4096 \
  opencode-dev-ubuntu22-arm
```

> 💡 `-v ~/opencode-dev/src:/root/opencode-src` 是关键：
> Mac 上的 `~/opencode-dev/src` 和容器里的 `/root/opencode-src` 是**同一个目录**。
> 你在 Mac 上用 VS Code 改文件，容器里的 Bun 立刻看到变化。

#### 3.4.5 克隆你的 Fork 并锁定版本

在容器内执行：

```bash
cd /root/opencode-src

# 克隆（替换为你的 GitHub 用户名）
git clone https://github.com/你的GitHub用户名/opencode.git .

# 锁定到 v1.14.41
git checkout v1.14.41

# 从这个版本创建你的开发分支
git checkout -b tracero-dev

# 确认版本
git log --oneline -1
# 应该显示 v1.14.41 相关的 commit
```

#### 3.4.6 安装依赖

```bash
cd /root/opencode-src

bun install
# 等待 3-5 分钟，看到 "done" 表示完成
```

#### 3.4.7 确认正确的启动命令

> ⚠️ **需要确认**：下面的启动命令基于官方 CONTRIBUTING.md 和源码结构推断，
> 在 v1.14.41 中应该有效，但不同版本可能有差异。
> **clone 完代码后，请先执行以下命令确认**：

```bash
# 查看 packages/opencode 的 scripts 字段
cat /root/opencode-src/packages/opencode/package.json | grep -A 20 '"scripts"'

# 查看根目录 package.json 的 scripts 字段
cat /root/opencode-src/package.json | grep -A 20 '"scripts"'
```

根据官方 CONTRIBUTING.md，**推荐的开发启动命令**（从项目根目录运行）：

```bash
cd /root/opencode-src

# 方式1：官方推荐（CONTRIBUTING.md 记载）
bun dev web

# 方式2：如果 bun dev 不可用，尝试
bun run --cwd packages/opencode --conditions=browser ./src/index.ts serve --port 4096

# 方式3：如果以上都不行，查看 packages/opencode/package.json 的 scripts 字段
# 找到 "dev" 或 "start" 对应的命令，替换使用
```

**Web UI 启动后**，打开 Mac 浏览器访问 `http://localhost:4096`。

#### 3.4.8 最小验证改动

在 **Mac 本机**打开 VS Code（不需要进容器）：

```bash
# Mac 终端
code ~/opencode-dev/src/packages/opencode/src/session/prompt.ts
```

搜索（Command+F）`runLoop` 或 `loop`，找到函数体开始处，加入：

```typescript
console.log("[Tracero-test] Agent loop started, sessionID:", sessionID)
```

保存文件（Command+S）。

切换到**运行 Bun 的容器终端**，如果 Bun 支持热重载会自动重启；否则手动重启：

```bash
# 容器内
# Ctrl+C 停止，然后重新运行
bun dev web
```

在浏览器发送一条消息，在容器终端里看到：

```
[Tracero-test] Agent loop started, sessionID: sess_xxxxxxxxxx
```

**看到这行 = 修改生效！**

#### 3.4.9 日常使用

```bash
# 下次启动开发容器（源码在 Mac 上，不会丢失）
docker start -ai opencode-dev

# 开第二个终端进同一容器
docker exec -it opencode-dev bash

# 容器里运行 OpenCode
cd /root/opencode-src
bun dev web
```

---

## 4. 环境2 — Windows 11 + WSL2 + Docker Desktop

> **前提**：已按《TurtleBot3仿真完整指南》配置好 WSL2 + Docker Desktop。
> **所有命令在 WSL2 Ubuntu 终端里执行**（不是 PowerShell）。

### 4.1 确认 Docker Desktop 正常

```bash
# 在 WSL2 Ubuntu 终端里
docker --version
docker ps

uname -m
# 期望：x86_64
```

### 4.2 Windows 11 Host 如何访问 WSL2 里的 Docker 挂载目录

**重要理解**：
- Windows 11 上，Docker 容器运行在 WSL2 里
- 挂载目录（如 `~/opencode-dev-win/src`）实际存储在 WSL2 的文件系统里
- 需要通过 **WSL2 文件系统访问路径** 才能从 Windows 侧访问

#### 方法1：File Explorer（文件资源管理器）

```
1. 打开 Windows 文件资源管理器（Win+E）
2. 在地址栏输入：\\wsl$\Ubuntu-22.04\home\你的用户名\opencode-dev-win\src
3. 回车，直接打开 WSL2 里的目录
```

> 💡 `\\wsl$\` 是 Windows 访问 WSL2 文件系统的特殊路径。`Ubuntu-22.04` 是 WSL2 发行版名称。

也可以直接输入 `\\wsl$` 查看所有 WSL2 发行版。

#### 方法2：VS Code Remote WSL（推荐，修改源码用这个）

**安装步骤**（只需一次）：

```
1. 打开 VS Code（Windows 本机）
2. 点击左下角 "><" 图标，或按 Ctrl+Shift+P
3. 搜索 "WSL" → 安装 "Remote - WSL" 扩展
```

**日常使用**：

```bash
# 在 WSL2 终端里，进入你想用 VS Code 打开的目录
cd ~/opencode-dev-win/src

# 用 Windows 的 VS Code 打开当前目录（WSL2 里运行）
code .
```

VS Code 窗口左下角会显示 "WSL: Ubuntu-22.04"，表示 VS Code 在 WSL2 环境里运行，可以直接编辑 WSL2 里的文件。

#### 方法3：WSL2 终端里直接编辑

```bash
# 在 WSL2 Ubuntu 终端里直接用 nano 或 vim 编辑
nano ~/opencode-dev-win/src/packages/opencode/src/session/prompt.ts
```

#### 实际工作流建议

**Windows 开发时推荐的分工**：

```
VS Code（Remote WSL）              Docker 容器（Bun 运行时）
──────────────────────             ──────────────────────────
在 WSL2 文件系统里编辑源码          执行 bun dev web
~/opencode-dev-win/src/  ←→       /root/opencode-src/
（同一份文件，实时同步）
```

> ⚠️ **性能提示**：WSL2 文件系统（`~/` 路径）访问速度比 Windows 文件系统（`/mnt/c/` 路径）快很多。
> 源码目录应该放在 WSL2 里（`~/opencode-dev-win/src`），不要放在 `/mnt/c/` 下。

---

### 4.3 阶段一：Alpine x64 image 体验 OpenCode（不修改源码）

> **注意**：容器名称用 `opencode-alpine-win`，区别于 TurtleBot3 的容器。

#### 4.3.1 准备持久化目录

```bash
# 在 WSL2 Ubuntu 终端里执行
mkdir -p ~/opencode-data/share
mkdir -p ~/.config/opencode
mkdir -p ~/opencode-workspace
```

#### 4.3.2 写入 DeepSeek 配置

```bash
nano ~/.config/opencode/opencode.jsonc
```

粘贴以下内容（替换 API Key）：

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "deepseek": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "DeepSeek",
      "options": {
        "baseURL": "https://api.deepseek.com",
        "apiKey": "YOUR_DEEPSEEK_API_KEY"
      },
      "models": {
        "deepseek-v4-pro": {
          "name": "DeepSeek-V4-Pro",
          "limit": {
            "context": 1048576,
            "output": 262144
          },
          "reasoning": true
        }
      }
    }
  },
  "model": "deepseek/deepseek-v4-pro"
}
```

保存：`Ctrl+X` → `Y` → `Enter`

#### 4.3.3 拉取指定版本 Alpine x64 image

```bash
# 拉取锁定版本（自动选择 amd64 layer）
docker pull ghcr.io/anomalyco/opencode:1.14.41

# 验证是 amd64
docker inspect ghcr.io/anomalyco/opencode:1.14.41 \
    --format '{{.Architecture}}'
# 期望：amd64
```

#### 4.3.4 以 Web UI 模式启动

```bash
docker run -it \
  --name opencode-alpine-win \
  -p 4096:4096 \
  -v ~/.config/opencode:/root/.config/opencode \
  -v ~/opencode-data/share:/root/.local/share/opencode \
  -v ~/opencode-workspace:/workspace \
  -w /workspace \
  ghcr.io/anomalyco/opencode:1.14.41 \
  web --hostname 0.0.0.0 --port 4096
```

#### 4.3.5 在 Windows 浏览器里访问

打开 Windows 浏览器（Edge/Chrome），访问：

```
http://localhost:4096
```

> 💡 Docker Desktop 自动把容器端口转发到 Windows localhost。

#### 4.3.6 配置文件的 Windows 本机修改方式

容器运行期间，从 Windows 侧修改配置：

**方法1**：用 VS Code Remote WSL 打开并编辑

```bash
# WSL2 终端
code ~/.config/opencode/opencode.jsonc
```

**方法2**：File Explorer 访问

```
\\wsl$\Ubuntu-22.04\home\你的用户名\.config\opencode\opencode.jsonc
```

修改保存后重启容器：

```bash
docker restart opencode-alpine-win
```

#### 4.3.7 日常操作命令

```bash
docker start opencode-alpine-win   # 启动
docker stop opencode-alpine-win    # 停止
docker ps -a | grep opencode       # 查看状态
```

---

### 4.4 阶段二：Ubuntu 22.04 x64 开发环境（可修改 Bun 后端）

> **注意**：这个容器和 TurtleBot3 的容器完全不同：
> - TurtleBot3 容器：`turtlebot3_apt` / `turtlebot3_src`，含 ROS2 + Gazebo
> - OpenCode 开发容器：`opencode-dev-win`，含 Bun + OpenCode 源码
> 两套容器独立运行，互不影响。

#### 4.4.1 Fork OpenCode 仓库

访问 `https://github.com/anomalyco/opencode`，点击右上角 **Fork**。

#### 4.4.2 创建工作目录和 Dockerfile

```bash
# 在 WSL2 Ubuntu 终端里
mkdir -p ~/opencode-dev-win/src
cd ~/opencode-dev-win

cat > Dockerfile << 'EOF'
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai

RUN apt-get update && apt-get install -y \
    curl wget git vim nano \
    build-essential cmake \
    ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /root/opencode-src /root/.config/opencode

WORKDIR /root
CMD ["/bin/bash"]
EOF
```

#### 4.4.3 构建镜像

```bash
cd ~/opencode-dev-win

docker build -t opencode-dev-ubuntu22-x64 .

docker images | grep opencode-dev-ubuntu22-x64
```

#### 4.4.4 启动开发容器

```bash
docker run -it \
  --name opencode-dev-win \
  -v ~/opencode-dev-win/src:/root/opencode-src \
  -v ~/.config/opencode:/root/.config/opencode \
  -p 4096:4096 \
  opencode-dev-ubuntu22-x64
```

#### 4.4.5 克隆 Fork 并锁定版本

在容器内执行：

```bash
cd /root/opencode-src

git clone https://github.com/你的GitHub用户名/opencode.git .

# 锁定版本
git checkout v1.14.41
git checkout -b tracero-dev

git log --oneline -1
```

#### 4.4.6 安装依赖

```bash
cd /root/opencode-src
bun install
```

#### 4.4.7 确认正确的启动命令

> ⚠️ **需要确认**：以下命令基于官方 CONTRIBUTING.md 推断，clone 后请先查看 scripts：

```bash
# 查看启动脚本定义
cat /root/opencode-src/packages/opencode/package.json | grep -A 20 '"scripts"'
cat /root/opencode-src/package.json | grep -A 20 '"scripts"'
```

**推荐启动命令**（容器内，从项目根目录）：

```bash
cd /root/opencode-src

# 官方推荐方式
bun dev web

# 如果不可用，尝试
bun run --cwd packages/opencode --conditions=browser \
    ./src/index.ts serve --port 4096
```

#### 4.4.8 最小验证改动

在 **VS Code Remote WSL** 里打开源码（推荐）：

```bash
# WSL2 Ubuntu 终端里（不是容器内）
code ~/opencode-dev-win/src/packages/opencode/src/session/prompt.ts
```

搜索 `runLoop` 或 `loop`，在函数体开始处加入：

```typescript
console.log("[Tracero-test] Agent loop started, sessionID:", sessionID)
```

保存，然后在容器终端里重启：

```bash
# 容器内
# Ctrl+C 停止，然后
bun dev web
```

打开 Windows 浏览器访问 `http://localhost:4096`，发送消息，确认容器终端出现日志。

#### 4.4.9 日常使用

```bash
# 重新进入容器
docker start -ai opencode-dev-win

# 开第二个终端
docker exec -it opencode-dev-win bash

# 在容器内启动
cd /root/opencode-src && bun dev web
```

#### 4.4.10 与 TurtleBot3 容器并行使用

```bash
# 两者可以同时运行
docker ps
# 可以看到 turtlebot3_apt 和 opencode-dev-win 同时运行

# TurtleBot3（Tracero A 模块）
docker start -ai turtlebot3_apt

# OpenCode 开发（Tracero B 模块）
docker start -ai opencode-dev-win
```

---

## 5. 附件

### 5.1 官方文档链接

| 文档 | 链接 |
|---|---|
| OpenCode 官网 | https://opencode.ai |
| OpenCode 安装文档 | https://opencode.ai/docs |
| OpenCode Server 模式文档 | https://opencode.ai/docs/server |
| OpenCode CLI 参考 | https://opencode.ai/docs/cli |
| OpenCode CONTRIBUTING.md | https://github.com/anomalyco/opencode/blob/dev/CONTRIBUTING.md |
| DeepSeek API 文档 | https://api-docs.deepseek.com |
| DeepSeek + OpenCode 集成指南 | https://api-docs.deepseek.com/quick_start/agent_integrations/opencode |
| DeepSeek API Key 申请 | https://platform.deepseek.com/api_keys |

### 5.2 核心 GitHub 仓库

| 仓库 | 说明 |
|---|---|
| [anomalyco/opencode](https://github.com/anomalyco/opencode) | OpenCode 主仓库，fork 这个 |
| [pilinux/opencode-docker](https://github.com/pilinux/opencode-docker) | 社区 Docker image（amd64/arm64）|
| [FelixClements/opencode-server-docker](https://github.com/FelixClements/opencode-server-docker) | headless server 模式 Docker image |

### 5.3 版本锁定操作速查

```bash
# fork 后锁定版本
git checkout v1.14.41
git checkout -b tracero-dev

# Docker image 锁定版本
docker pull ghcr.io/anomalyco/opencode:1.14.41

# 确认 image 版本
docker inspect ghcr.io/anomalyco/opencode:1.14.41 \
    --format '{{.Architecture}} {{.Id}}'
```

### 5.4 OpenCode 源码关键文件

| 文件 | 作用 |
|---|---|
| `packages/opencode/src/session/prompt.ts` | **Agent Loop 核心** |
| `packages/opencode/src/session/processor.ts` | LLM 流式输出处理 |
| `packages/opencode/src/session/llm.ts` | LLM 调用层 |
| `packages/opencode/src/session/index.ts` | Session 状态管理 |
| `packages/opencode/src/provider/` | LLM 提供商适配 |
| `packages/opencode/src/server/server.ts` | HTTP Server 路由 |
| `packages/opencode/package.json` | **启动命令在这里的 scripts 字段** |
| `CONTRIBUTING.md`（根目录） | 官方开发启动说明 |

### 5.5 Docker image 速查

| image | 架构 | 用途 |
|---|---|---|
| `ghcr.io/anomalyco/opencode:1.14.41` | amd64 + arm64 自动选 | 阶段一体验 |
| `ubuntu:22.04`（自建） | 对应宿主机架构 | 阶段二开发 |

### 5.6 命令速查卡

**Mac arm64**

```bash
# 阶段一：体验（Alpine）
docker run -it --name opencode-alpine -p 4096:4096 \
  -v ~/.config/opencode:/root/.config/opencode \
  -v ~/opencode-data/share:/root/.local/share/opencode \
  -v ~/opencode-workspace:/workspace -w /workspace \
  ghcr.io/anomalyco/opencode:1.14.41 web --hostname 0.0.0.0 --port 4096

# 阶段二：开发（Ubuntu ARM）
docker run -it --name opencode-dev -p 4096:4096 \
  -v ~/opencode-dev/src:/root/opencode-src \
  -v ~/.config/opencode:/root/.config/opencode \
  opencode-dev-ubuntu22-arm

# 容器内启动 OpenCode（开发模式）
cd /root/opencode-src && bun dev web

# Mac 本机访问挂载目录（Finder）
# 前往 → 前往文件夹 → ~/opencode-dev/src

# Mac 本机用 VS Code 打开
code ~/opencode-dev/src
```

**Windows 11 x64（WSL2 终端里执行）**

```bash
# 阶段一：体验（Alpine）
docker run -it --name opencode-alpine-win -p 4096:4096 \
  -v ~/.config/opencode:/root/.config/opencode \
  -v ~/opencode-data/share:/root/.local/share/opencode \
  -v ~/opencode-workspace:/workspace -w /workspace \
  ghcr.io/anomalyco/opencode:1.14.41 web --hostname 0.0.0.0 --port 4096

# 阶段二：开发（Ubuntu x64）
docker run -it --name opencode-dev-win -p 4096:4096 \
  -v ~/opencode-dev-win/src:/root/opencode-src \
  -v ~/.config/opencode:/root/.config/opencode \
  opencode-dev-ubuntu22-x64

# 容器内启动 OpenCode（开发模式）
cd /root/opencode-src && bun dev web

# Windows 访问 WSL2 挂载目录
# 文件资源管理器地址栏输入：\\wsl$\Ubuntu-22.04\home\用户名\opencode-dev-win\src

# VS Code Remote WSL 打开
code ~/opencode-dev-win/src    # 在 WSL2 终端里执行
```

### 5.7 常见问题

**Q：Mac + Docker，Host 侧如何访问容器源码**

映射目录无需修改
-v ~/opencode-dev-win/src:/root/opencode-src 中的 ~/opencode-dev-win/src 是 Mac 本机文件系统的路径（~ 展开为 /Users/你的用户名/）。
Mac 的 Docker Desktop 直接把 Mac 文件系统路径挂载进容器，两侧共享同一份文件，不需要任何中间层。
从 Mac Host 访问源码的两种方式

方式1：VS Code（推荐，改代码用这个）
在 Mac 终端里：
```bash
code ~/opencode-dev-win/src
```
直接打开，在 Mac VS Code 里编辑保存，容器内的 Bun 进程立即看到变化，不需要进容器操作。

方式2：Finder
Command + Shift + G → 输入 ~/opencode-dev-win/src → 回车

**Q：Windows 11 WSL2 + Docker，Host 侧访问容器源码**
映射目录的修改
当前命令把 ~/workspace/turtlebot3_apt/home 挂载进容器，这个路径是 WSL2 文件系统里的路径（~ 展开为 /home/你的用户名/），不是 Windows 文件系统。
不需要修改 -v 参数本身，挂载路径保持不变，从 Windows 侧访问 WSL2 文件系统即可。
从 Windows Host 访问源码的两种方式

方式1：VS Code Remote WSL（推荐，改代码用这个）
在 WSL2 Ubuntu 终端里：
```bash
cd ~/workspace/turtlebot3_apt/home
code .
```
VS Code 窗口左下角显示 "WSL: Ubuntu-22.04"，此时编辑的就是容器挂载的同一份文件，保存后容器内立即可见，无需任何同步。


方式2：文件资源管理器
在地址栏输入：
```bash
\\wsl$\Ubuntu-22.04\home\你的用户名\workspace\turtlebot3_apt\home
```
直接浏览，可以用 Windows 的任何编辑器打开文件。

⚠️ 不要把源码放在 /mnt/c/ 这类 Windows 文件系统路径下再挂载进 Docker，WSL2 跨文件系统的 I/O 性能很差，colcon build 会极慢。保持源码在 WSL2 的 ~/ 路径下是正确做法。

**Q：浏览器访问 localhost:4096 显示无法连接**

```bash
docker ps | grep opencode
# 如果没有，重新 docker start 容器名
```

**Q：DeepSeek API 返回 401 错误**

检查 `~/.config/opencode/opencode.jsonc` 里的 API Key 是否正确（`sk-` 开头）。

**Q：bun install 报网络错误**

容器内网络和宿主机共享，检查宿主机网络。也可以尝试：

```bash
bun install --no-progress
```

**Q：修改了 prompt.ts，但没看到 console.log 输出**

```bash
# 确认跑的是源码，不是二进制
# 正确（跑源码，能看到改动）
bun dev web

# 错误（跑编译好的二进制，看不到改动）
opencode web
```

**Q：bun dev web 命令找不到**

```bash
# 查看实际的 scripts 定义
cat packages/opencode/package.json | grep -A 20 '"scripts"'
cat package.json | grep -A 20 '"scripts"'
# 找到 dev 或 start 对应的命令替换使用
```

**Q：Windows 上 File Explorer 访问 \\wsl$ 找不到目录**

确认 WSL2 Ubuntu 正在运行：在 PowerShell 里输入 `wsl --list --running`，看到 Ubuntu-22.04 即可。

---

> **文档版本**：2026年5月，锁定 OpenCode v1.14.41
> **对应项目**：Tracero · 智循 — 机器人与自驾行为溯源系统
> **B 模块同学注意**：修改 Bun 循环后，下一步是实现
> `fetchTraceroEvidence()`（从 SQLite 读取运行时证据）和
> `traceroVerifier.check()`（校验每条结论是否引用 evidence_id）。
