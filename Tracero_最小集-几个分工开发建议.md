# Tracero · 智循
## 最小集合作开发建议

---

## 目录

1. 开发者使用过程
2. 演示过程
3. 建议模块划分
4. 同学建议分工
5. 模块之间的数据流与接口协议

---

## 一、开发者使用过程

### 场景描述

开发者（机器人 / 自驾系统工程师）在系统运行后，通过 Tracero 界面查询"为什么这次导航失败了"，并得到带证据的解释。

### 完整流程

```
步骤 1：打开浏览器进入 Tracero 界面（http://machine-b:3000）

步骤 2：在事件列表页看到自动捕获的异常事件，例如
        14:32:07  导航失败  costmap 异常
        13:15:44  急停触发  速度异常
        11:08:21  路径重规划 目标不可达

步骤 3：点击事件进入详情页（三栏布局）
        左栏=消息时间线 / 中栏=证据面板 / 右栏=AI 解释 + Chat
        右栏给出三段式结论（事实 / 推理 / 建议），每句旁带证据角标 [E-xx]

步骤 4：点击证据角标 [E-03]，展开当时那一帧的真实数据
        - 时间戳、costmap 原始数据摘要
        - 对应源码：nav2_controller/src/controller_server.cpp:387
        - 相关参数：controller_frequency=20.0（来自 nav2_params.yaml:45）

步骤 5：在右侧 Chat 框追问
        "inflation_radius 参数是多少，在哪定义的？"
        AI 基于已有证据回答并引用 nav2_params.yaml 第 45 行（不重新推理整个事件）

步骤 6：切换用户视角（右上角下拉）
        开发视角 → 完整代码引用 + 参数 + 时序
        测试视角 → 隐藏代码行号，只显示模块归因和分配建议
        运营视角 → 只剩一句自然语言结论

步骤 7：点击"导出 Bug 报告"
        生成结构化报告（Markdown / 纯文本），可直接粘进飞书 / Jira / GitHub Issues
```

### 历史事件 vs 当前事件的行为差异

| 事项 | 历史事件 | 当前 / Live 事件 |
|------|---------|--------------|
| AI 结论 | 直接从数据库读取，纯显示 | 等待推理完成，流式显示 |
| 是否重新推理 | ❌ 不重新推理（结论已固化） | ✅ 推理进行中 |
| Chat 追问 | ✅ 支持（基于已有证据） | ✅ 支持（推理完成后） |
| 时间线 / 证据 | 从数据库读，纯显示 | 从数据库读（落盘后） |

---

## 二、演示过程

### 2.1 TurtleBot3 仿真演示（主演示，比赛当前阶段）

**硬件需求**：两台电脑（Machine A + Machine B），无需实体机器人。

```
演示前准备：
  Machine A：Gazebo 仿真 + TurtleBot3 + Nav2 + Tracero Agent + rosbridge
  Machine B：Tracero 后端 + 前端
  两台机器在同一局域网，浏览器指向 http://machine-b:3000
```

**演示脚本（约 8 分钟，可按需调整）**

```
第一幕 介绍场景（1 min）：Gazebo 里一辆小车正在自主导航。

第二幕 制造异常（1 min）：动态 spawn 一个障碍物到机器人路径上，
       机器人未及时停下，Nav2 报告导航失败，
       Tracero 界面自动弹出新事件"14:32:07 导航失败"（无需手动操作）。

第三幕 问 AI（2 min）：点击事件，在 Chat 框输入"为什么刚才没停下来？"，
       约 10–30 秒后返回三段式结论：
         【事实】障碍物出现时 costmap 更新延迟 340ms
         【推理】controller_server.cpp 第 387 行使用旧地图数据，
                障碍物信息未传达至规划模块
         【建议】调低 update_frequency 或提升 LiDAR 数据频率

第四幕 点击证据角标（1 min）：点 [E-03]，展开真实 costmap 数据 +
       源码定位 controller_server.cpp:387。强调：结论有据可查，不是 AI 自由发挥。

第五幕 切换视角（2 min，最有冲击力）：
       开发视角 → 测试视角（代码行号消失，只剩"局部代价地图模块异常，建议分配给感知/导航组"）
       → 运营视角（只剩"系统未能及时响应障碍物，建议升级至测试团队"）。
       强调：同一份证据，三种人看到不同深度的内容。

第六幕 导出 Bug 报告（1 min）：点击导出，展示结构化报告，说明可直接粘进缺陷管理系统。
```

### 2.2 TurtleBot3 实车演示（后续可选阶段）

实车演示是后续条件具备后的加分项，**当前最小集阶段不必投入**，这里只留一个备忘：

实车与仿真对 Tracero 而言几乎没有区别——Agent 和 Machine B 完全不变，差异只在 Machine A 的启动命令：

```
仿真：ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
实车：ros2 launch turtlebot3_bringup robot.launch.py
```

演示时由演示者手动在小车前放一个障碍物（书 / 杯子）触发碰撞，后续幕次与仿真完全相同。若决定接入实车，建议先在 Gazebo 完整跑通，再在比赛前 1–2 周接入实体小车（TurtleBot3 烧 Ubuntu 22.04 + ROS2 Humble，与 Machine A 同一 WiFi、ROS_DOMAIN_ID 一致）。

---

## 三、建议模块划分

### 建议的设计原则

> **需要落盘的数据 → 经过 B**
> **不需要落盘的实时数据 → 直接 A 到 C**

---

### 模块 A：机器人系统 + 数据获取 Agent + 错误注入

**建议负责**：A 同学

**职责范围**：

```
1. 仿真环境搭建（主力）
   - ROS2 Humble + TurtleBot3（源码 build）+ Nav2（源码 build）+ Gazebo
   - 源码 build 目的：为静态分析器提供完整 C++ 源码

2. 错误注入 / 异常触发机制
   - 提供一套"主动制造异常"的手段，让演示与测试可控、可复现，例如：
     · 动态 spawn 障碍物到机器人路径上（核心演示用）
     · 参数扰动（如把 inflation_radius 改到不合理值）
     · 传感器异常模拟（如 /scan 丢帧、延迟、加噪）
     · 消息时序扰动（人为制造 costmap 更新延迟）
   - 每种注入方式封装成一条命令或一个小脚本/节点，便于现场一键触发
   - 注入点与 TC 场景一一对应，保证"同样的注入 → 同样的异常"

3. 测试场景设计与复现
   - TC-01：障碍物突然出现（核心演示场景，对应"动态 spawn"注入）
   - TC-02：代价地图参数不合理（inflation_radius 过小，对应"参数扰动"注入）
   - TC-03：目标点不可达（规划反复失败）
   - TC-04：里程计漂移（地面光滑导致 /odom 不准）
   每个场景建议做到稳定可复现，结果一致

4. Tracero Agent（Python，轻量）
   - 订阅关键 ROS2 topic
   - 维护 5 秒环形缓冲
   - 规则触发器（急停 / 规划失败 / costmap 空窗）
   - 异常触发时打包切片，HTTP POST 推送给 B
   - 启动时推送参数快照给 B

5. 静态分析器（tree-sitter）
   - 扫描 Nav2 + TurtleBot3 源码
   - 生成消息映射 JSON 索引
   - 开发期离线运行一次，结果交给 B 加载

6. rosbridge 启动
   - 为 C 提供实时 topic 的 WebSocket 接口
   - 一条命令启动，基本不需额外开发
```

**关键产出物**：

```
① 能稳定复现的 TC-01 场景 + 对应错误注入脚本（最优先）
② Tracero Agent（Python）：事件触发 + HTTP 切片推送
③ 静态索引 JSON（tree-sitter 扫描产物）
④ 错误注入工具集（spawn / 参数扰动 / 传感器异常等，与 TC 场景对应）
⑤ rosbridge 启动配置
⑥ 参数快照格式（与 B 对齐）
```

**建议订阅的 Topic 清单**：

```
/odom                              # 位置、速度
/scan                              # LiDAR
/cmd_vel                           # 速度指令
/global_costmap/costmap            # 全局代价地图
/local_costmap/costmap             # 局部代价地图
/plan                              # 全局路径
/local_plan                        # 局部路径
/navigate_to_pose/_action/status   # 导航任务状态
/diagnostics                       # 各节点健康状态
```

---

### 模块 B：LLM Agent 推理 + 推理用数据落盘

**建议负责**：B 同学

**职责范围**：

```
1. 数据接收与落盘（FastAPI + SQLite）
   - 接收 A 推来的事件切片包（HTTP POST）
   - 接收 A 推来的参数快照（启动时）
   - 加载 A 生成的静态索引 JSON
   - 存入 SQLite（runs / events / timeseries / evidence 表）

2. Evidence Builder
   - 将运行时切片 + 静态索引 + 参数快照组装成结构化证据包（带 evidence_id）

3. LLM Agent Loop + MCP 工具
   - 初始证据包喂给 LLM，LLM 判断是否需要更多证据
   - 按需调用三个 MCP 工具：
     · query_message_mapping：查 topic → 代码行的映射
     · query_source_code：查具体代码片段
     · query_runtime_data：查运行时时序数据
   - Agent loop 直到证据充足

4. Verifier 校验
   - 每条 LLM 输出结论必须引用 evidence_id
   - 无 evidence_id 的结论被拒绝，触发重试
   - 通过校验的结论存入数据库（full / test / ops 三版本）

5. REST API（供 C 调用）
   - GET  /api/runs                    # 事件列表
   - GET  /api/runs/:id                # 事件详情 + 证据 + 结论
   - GET  /api/runs/:id/status         # 推理状态（轮询用）
   - GET  /api/runs/:id/evidence/:eid  # 单条证据展开
   - POST /api/runs/:id/chat           # Chat 追问

6. 三视角权限字段
   - 每条证据 / 结论带 visible_to 字段（dev / test / ops）
   - API 按请求方视角过滤返回内容
```

**关键产出物**：

```
① FastAPI 服务 + SQLite schema
② Evidence Builder（多源数据组装逻辑）
③ LLM Agent loop + 三个 MCP 工具
④ Verifier（evidence_id 校验）
⑤ REST API（覆盖 C 需要的所有端点）
⑥ 三视角权限过滤逻辑
```

---

### 模块 C：前端显示 + 用户交互

**建议负责**：C 同学

> 说明：本模块的**具体 UI 库尚未确定**（shadcn-admin 还是 Ant Design 5，见第四章 C 同学部分，由 C 第一周自行试用后决定）。下面的职责描述刻意写成与 UI 库无关——React + TypeScript + Vite 是两个候选的公共底座，三栏布局、视角切换、证据展开这些功能两套方案都能实现。所以这里**不预设**用哪一套，待 C 决定后再落地即可。

**职责范围**：

```
1. 整体前端框架
   - React + TypeScript + Vite（公共底座）
   - 侧边栏 + 顶栏 + 路由
   - 具体 UI 组件库见第四章，由 C 同学选定

2. 页面：事件列表页（/runs）
   - 展示所有历史事件（调 B 的 GET /api/runs）
   - 新事件实时出现（轮询）
   - 按时间排序，显示事件类型 / 时间 / 状态

3. 页面：事件详情页（/runs/:id）三栏布局
   - 左栏：消息时间线（从 B 的 API 读取，按时间排列 topic 事件）
   - 中栏：证据面板（evidence 列表，点击展开，代码片段高亮，参数格式化）
   - 右栏：AI 解释 + Chat
     · 三段式输出（事实 / 推理 / 建议）
     · Chat 框支持追问（POST /api/runs/:id/chat）
     · 历史事件直接渲染数据库结论；当前事件轮询 status，结论出来后渲染

4. 组件：视角切换器（建议最高优先级）
   - 右上角下拉菜单：开发 / 测试 / 运营
   - 切换后整个页面的可见字段实时过滤
   - 建议用 React Context 实现，对所有子组件透明

5. 组件：Bug 报告导出
   - 点击按钮生成结构化报告（Markdown）
   - 按当前视角导出对应深度的内容

6. 实时车辆状态显示（接 rosbridge）
   - 用 roslibjs 直连 Machine A 的 rosbridge WebSocket
   - 订阅 /odom → 显示当前位置 / 速度
   - 订阅 /navigate_to_pose/_action/status → 显示导航状态
   - 订阅 /plan → 可选：显示规划路径
   - 此数据不经过 B，直接 A → C
```

**关键产出物**：

```
① 事件列表页（/runs）
② 事件详情页（/runs/:id）：三栏布局
③ 视角切换器 Context + 字段过滤逻辑
④ Evidence 角标点击展开组件
⑤ Bug 报告导出
⑥ rosbridge 实时状态接入（roslibjs）
```

---

## 四、同学建议分工

> 下面是对每位同学路径的建议，包含推荐的推进顺序、需要自己拿主意的关键决策点、以及彼此补位的方式。**所有安排都可以调整**，三位同学按各自情况商量即可。

### 建议总览

| 模块 | 同学 | 核心职责 | 特点 |
|------|------|---------|------|
| A | A 同学 | 仿真环境 + 错误注入 + Agent + 静态分析 | 前期密集，有大量文档可循 |
| B | B 同学 | 推理引擎 + 数据落盘 + API | 全程持续，是整个系统的中心节点 |
| C | C 同学 | 前端 + 实时显示 + 用户体验 | 后期密集，演示效果直接决定评委第一印象 |

---

### A 同学的工作范围

A 的核心路线清晰、文档完整，每一步基本都有官方资料支撑。

**主线**：ROS2 Humble 环境 → TurtleBot3 + Nav2 源码 build → 错误注入与 Gazebo 场景 → Tracero Agent → tree-sitter 静态分析器 → rosbridge。

**源码 build 是一个关键技术前提（强烈建议）**：建议源码 build TurtleBot3 和 Nav2，而不是只用 apt 安装。原因是 Tracero 的核心价值在于"结论有据可查、能精确到代码行"，没有源码 tree-sitter 就扫不到东西，B 的推理结论只能说"模块出了问题"，没法说"第 387 行的逻辑导致了这个结果"。

**错误注入是 A 的一项独立职责**：异常不会自己发生，需要 A 提供"主动制造异常"的手段（动态 spawn 障碍物、参数扰动、传感器丢帧/加噪、消息时序扰动等），每种封装成一条命令或小脚本，现场可一键触发，并与 TC 场景一一对应，保证"同样的注入 → 同样的异常"。这是整个演示和回归测试可控、可复现的基础。

**TC-01 建议最先做**：四个场景里，TC-01（障碍物突然出现）是演示的核心，建议优先做到稳定复现（含对应的 spawn 注入脚本），其余场景在 TC-01 之后再补。

**A 的补位方向（场景稳定后）**：A 最熟悉运行时数据格式，场景稳定后可以去帮 B 实现 `query_runtime_data` 这个 MCP 工具（它负责从已落盘数据中按时间范围查询时序片段，A 最清楚数据长什么样）。

---

### B 同学的工作范围

B 是整个系统的中心节点，两侧都有依赖：A 的数据推过来要消费，C 的 API 请求要响应。B 的工作贯穿项目始终，没有明显的"轻松期"。

**关于 Agent Loop 的实现方式（建议）**：项目文档提到 OpenCode，但 OpenCode 本质是一个终端式交互工具，不太适合直接嵌入 FastAPI 服务。建议 B 参考它的思路，用 DeepSeek API + MCP SDK 自己实现 Agent loop——核心逻辑只有几十行，完全可控，且和 FastAPI 天然集成。

**最小路径建议**：先用 mock JSON 数据跑通 `LLM 输入证据包 → 输出三段式结论` 这一步，不必等 A 的真实数据；mock 数据自己构造，先验证 Prompt 和 Verifier 逻辑，等 A 的切片推过来再替换。

**SQLite schema** 建议等 A 的切片格式确认后再定表结构，不必提前猜字段；接口协议第一周对齐后再建表会更稳。

**B 的被补位方向**：C 等待 B 的 API 期间，可以帮 B 写 Verifier 的测试用例（构造一批有 / 没有 evidence_id 的 LLM 输出，验证 Verifier 能正确拒绝）。

---

### C 同学的工作范围

C 的工作在前期可以完全独立于 A 和 B 推进——用 mock 数据先把界面做出来，等 B 的 API 稳定后再替换真实数据。**演示时评委第一眼看到的就是 C 的界面**，视角切换那一幕是整个演示最有冲击力的时刻，C 的产出很大程度上决定项目的感知质量。

#### C 同学的技术路线：建议用一周自己决定

前端 UI 库有两个候选，建议 C 用第一周亲手各试一遍，用同一个目标任务对比体验，自己拿主意。

**目标任务**：用两个方案各实现一次"Tracero 事件列表页最小版本"：
- 有侧边栏（两个菜单项）
- 有一个表格（3 条 mock 事件记录）
- 右上角有"开发 / 测试 / 运营"三选一下拉

---

**候选一：shadcn-admin**

地址：https://github.com/satnaing/shadcn-admin （约 11k stars，2026 年初仍在活跃维护，已适配 Tailwind v4）

技术栈：React + TypeScript + Vite + TailwindCSS + shadcn/ui

```bash
git clone https://github.com/satnaing/shadcn-admin
cd shadcn-admin
pnpm install && pnpm run dev
```

第一天就能看到一个有侧边栏、顶栏、暗色模式、命令面板（Cmd+K）的专业界面。

优势：视觉效果现代，第一眼就像真产品，对演示有直接帮助；clone 即用，不必从零搭布局；Tailwind 学习成本比想象低（就是加 class，看到什么改什么）；组件源码就在项目里，看不懂可以直接读，改起来可控；Chat 组件可用 shadcn-chatbot-kit 一条命令补充。

需要留意：文档全英文，中文资料相对少；它的路由用的是 TanStack Router（文件式路由），第一次接触需要一点时间适应；Tailwind + Radix 的组合式思维也需要一点上手成本。

---

**候选二：Vite + Ant Design 5**

地址：antd 官方文档 https://ant.design/docs/react/introduce-cn

技术栈：React + TypeScript + Vite + antd + @ant-design/x（Chat 组件）

```bash
npm create vite@latest tracero-frontend -- --template react-ts
cd tracero-frontend
npm install antd @ant-design/x
```

优势：中文官方文档，每个组件都有完整示例代码，遇到问题直接查；组件语义清晰（`<Timeline>` 就是时间线，`<Table>` 就是表格）；`@ant-design/x` 提供 AI 对话专用的 Bubble + Sender 组件，与 antd 同一套设计语言；中文社区答案多，大一同学遇到问题容易搜到方案。

需要留意：从 `npm create vite` 起步确实是"白板"，侧边栏布局要自己用 `<Layout>` 搭；不过 antd 也有官方完整模板 **Ant Design Pro**（开箱即用、带菜单/布局/mock），如果想要现成模板可以用它起步——代价是它更"重"、更有既定结构，定制时要先理解它的约定。两条路各有取舍，C 可以一并试。

---

**一周体验后，可以问自己三个问题再选一个：**

```
1. 哪个让我第一天就看到了接近成品的效果？
2. 哪个遇到问题时更容易找到答案？
3. 哪个我更愿意在上面继续写 8 周代码？
```

两个都能做出来，没有错误答案。一旦选定，建议就专注往前走，不必反复横跳。

---

### 三人马上可以开始的工作

三人可以完全并行，互不阻塞。**本周建议唯一需要协作的一件事**：用半天开一次会，把 A→B 的切片 JSON 格式和 B→C 的 API 返回字段写成文档，三人确认。这件事越早做，后续越不容易卡。

下面给每位同学一个**可选的启动节奏建议**，三位同学按自己的实际情况调整即可。

**A 同学（建议从环境跑通开始）**

```
今天：
  在 Ubuntu 22.04 上安装 ROS2 Humble
  跑通官方小乌龟示例（ros2 run turtlesim turtlesim_node），验证环境

明天：
  apt 安装 TurtleBot3 + Nav2（先 apt，跑通再换源码 build）
  跑通 Gazebo 里的第一次导航（小车能自主走到目标点）

这周内：
  apt 版跑稳后切换到源码 build
  build 完成后用 ros2 topic list 确认所有 topic 都在
  试做第一个错误注入：在 Gazebo 里 spawn 一个障碍物，作为 TC-01 的雏形
```
卡点预判：源码 build 第一次可能遇到依赖冲突，多预留半天；遇到问题去 Nav2 GitHub Issues 搜，通常都有人踩过。

**B 同学（建议从打通 API 开始）**

```
今天：
  注册 DeepSeek API 拿到 Key
  写 10 行 Python 调通 DeepSeek（发一条消息、收到回复），确认延迟可接受

明天：
  装 FastAPI + uvicorn，写一个最简 /hello 端点跑通
  手写一个 mock 切片包（模拟 A 会推过来的数据）

这周内：
  写最简 Agent loop：mock 证据包 → 组装 Prompt → DeepSeek → 解析输出
  先不接 MCP、不接 Verifier，跑通"输入数据、输出三段式结论"即可
  草拟 SQLite schema（等接口协议会议后再最终确认）
```
小提示：Agent loop 建议直接用 DeepSeek API + 自己写 loop，不必走 OpenCode CLI 进程调用，更简单可控。

**C 同学（建议从看见界面开始）**

```
今天：
  装 Node.js + pnpm
  把 shadcn-admin clone 下来跑起来，点一点，感受第一眼效果

明天：
  用 Vite + antd 从零新建项目，跑通一个 Layout+Sider 示例
  （如想对比模板，可顺手看一眼 Ant Design Pro）

这周内：
  用两个方案各实现"事件列表页最小版本"（侧边栏 + 表格 + 视角下拉）
  填 mock 数据，不接任何真实 API
  周末做选择，选一个继续
```
同时：和 B 约半天，把 B 的 API 返回字段结构确认下来，之后 C 用这个结构写 mock 数据，等真实 API 来了直接替换。

---

### 关键里程碑（建议）

```
本周末：
  接口协议文档三人确认（A→B 的 JSON 格式 + B→C 的 API 结构）
  A：Gazebo 导航第一次跑通，第一个错误注入（spawn 障碍物）成型
  B：DeepSeek API 调通，最简 Agent loop 有输出
  C：两个方案各跑起来，做出选择

第 4 周末（关键节点）：
  端到端打通——TC-01 触发 → Agent 推送切片 → B 推理 → C 显示结论
  哪怕每个模块都很简陋，也建议优先把这一步打通
  这是项目能否演示的关键前提，强烈建议守住

比赛前 2 周：
  视角切换演示效果完整，Demo 脚本排练完成
  如条件允许，接入实车验证
```

---

### 补位建议

```
A 场景稳定后空闲   → 帮 B 实现 query_runtime_data MCP 工具
C 等待 B 的 API 期间 → 帮 B 写 Verifier 测试用例
任何人卡超过 1 天   → 当天在群里提出，其他人当天响应
接口需要改动       → 提出方说明原因，三人群里确认，更新文档版本号
```

---

## 五、模块之间的数据流与接口协议

> 本章是三个模块的对接约定，需要写得精确一些。建议三人第一周先把字段对齐一次；后续如需调整，最好彼此同步知会并更新本文档版本号。

### 5.1 数据流全景

```
┌─────────────────────────────────────────────────────────────────┐
│                    Machine A（仿真 + 错误注入 + Agent）           │
│                                                                  │
│  Gazebo/TurtleBot3/Nav2  ←  错误注入（spawn/参数扰动/传感器异常）  │
│       ↓ ROS2 Topics                                              │
│  Tracero Agent                                                   │
│       ↓                              rosbridge（WebSocket:9090） │
│  [异常触发] 打包切片                        ↓                    │
└──────────────┬──────────────────────────────┼────────────────────┘
               │ HTTP POST                    │ WebSocket
               │（落盘数据）                   │（实时状态，不落盘）
               ↓                              ↓
┌──────────────────────────┐    ┌─────────────────────────────────┐
│   Machine B（Tracero后端）│    │   Browser（Tracero前端）         │
│                          │    │                                 │
│  FastAPI 接收 → SQLite   │    │  roslibjs 订阅实时 topic        │
│  Evidence Builder        │    │  /odom → 位置速度显示            │
│  Agent Loop + MCP        │    │  /plan → 路径显示               │
│  Verifier                │    │  /navigate_*/status → 状态显示  │
│  REST API ───────────────┼────→  调 REST API 拿历史+推理结论    │
│                          │    │  渲染三栏页面                   │
└──────────────────────────┘    └─────────────────────────────────┘
```

---

### 5.2 接口协议：A → B（HTTP POST，落盘数据）

**事件切片推送**

```
POST http://machine-b:8000/api/ingest/event
Content-Type: application/json

{
  "event_type": "navigation_failed",       // 急停/规划失败/costmap空窗
  "trigger_time": 1747000000.123,          // Unix 时间戳（秒，浮点）
  "robot_id": "turtlebot3_burger_01",
  "window": {
    "pre_5s": [                            // 触发前 5 秒的关键帧
      {
        "topic": "/cmd_vel",
        "timestamp": 1746999995.100,
        "data": { "linear": {"x": 0.18}, "angular": {"z": 0.0} }
      },
      {
        "topic": "/local_costmap/costmap",
        "timestamp": 1746999995.200,
        "data": { "update_time": 1746999994.860, "age_ms": 340 }
      }
      // ... 其他关键 topic 的帧
    ],
    "post_2s": [ ... ]                     // 触发后 2 秒
  },
  "params_snapshot": {                     // 当前 nav2_params.yaml 快照
    "controller_frequency": 20.0,
    "inflation_radius": 0.55,
    "min_x_velocity_threshold": 0.001,
    "update_frequency": 5.0
  },
  "static_index_version": "a3f2c1"         // 对应的静态索引版本 hash
}

Response 200:
{
  "run_id": "run_20260518_143207",
  "status": "received"
}
```

**参数快照推送（启动时）**

```
POST http://machine-b:8000/api/ingest/params

{
  "timestamp": 1747000000.000,
  "params": { ... }         // nav2_params.yaml 全量
}
```

**静态索引上传（开发期一次）**

```
POST http://machine-b:8000/api/ingest/static_index

{
  "version": "a3f2c1",
  "index": {
    "/cmd_vel": {
      "publisher": {
        "node": "nav2_controller::ControllerServer",
        "file": "nav2_controller/src/controller_server.cpp",
        "line": 387,
        "snippet": "vel_cmd = computeVelocityCommands(pose, velocity);"
      },
      "related_params": [
        { "name": "controller_frequency", "file": "nav2_params.yaml", "line": 45 }
      ]
    },
    "/local_costmap/costmap": { ... }
    // ... 其他 topic
  }
}
```

---

### 5.3 接口协议：B → C（REST API）

**GET /api/runs**
```
Response 200:
{
  "runs": [
    {
      "run_id": "run_20260518_143207",
      "event_type": "navigation_failed",
      "trigger_time": 1747000000.123,
      "status": "done",          // reasoning / done / failed
      "summary": "costmap 更新延迟导致导航失败"
    }
  ]
}
```

**GET /api/runs/:id**
```
Header: X-Role: dev            // dev / test / ops（视角）

Response 200:
{
  "run_id": "run_20260518_143207",
  "event_type": "navigation_failed",
  "trigger_time": 1747000000.123,
  "status": "done",
  "timeline": [                // 时序事件列表（左栏用）
    {
      "timestamp": 1746999995.100,
      "topic": "/cmd_vel",
      "summary": "速度指令发出",
      "evidence_id": "E-01"
    }
  ],
  "evidence": [                // 证据列表（中栏用）
    {
      "evidence_id": "E-01",
      "visible_to": ["dev", "test", "ops"],
      "type": "runtime",
      "data": { "linear": {"x": 0.18} }
    },
    {
      "evidence_id": "E-02",
      "visible_to": ["dev"],   // 仅开发可见
      "type": "source_code",
      "file": "nav2_controller/src/controller_server.cpp",
      "line": 387,
      "snippet": "vel_cmd = computeVelocityCommands(pose, velocity);"
    }
  ],
  "conclusion": {              // AI 结论（右栏用）
    "fact": "障碍物出现时 costmap 更新延迟 340ms [E-03]",
    "reasoning": "controller_server.cpp 第 387 行 [E-02] 使用旧地图数据",
    "suggestion": "调低 update_frequency 或提升 LiDAR 频率"
  }
}
```

**GET /api/runs/:id/status**
```
Response 200:
{
  "status": "reasoning",       // received / reasoning / done / failed
  "progress": "正在查询代码映射..."
}
```

**POST /api/runs/:id/chat**
```
Request:
{
  "role": "dev",
  "message": "inflation_radius 参数在哪定义的？"
}

Response 200:
{
  "reply": "inflation_radius 定义在 nav2_params.yaml 第 45 行，当前值 0.55 [E-05]",
  "new_evidence": [
    {
      "evidence_id": "E-05",
      "visible_to": ["dev", "test"],
      "type": "parameter",
      "param_name": "inflation_radius",
      "value": 0.55,
      "file": "nav2_params.yaml",
      "line": 45
    }
  ]
}
```

---

### 5.4 接口协议：A → C（rosbridge WebSocket，实时状态）

```
连接地址：ws://machine-a:9090

C 订阅的 Topic：
┌──────────────────────────────────┬─────────────────────┬──────────────┐
│ Topic                            │ 消息类型              │ C 用途        │
├──────────────────────────────────┼─────────────────────┼──────────────┤
│ /odom                            │ nav_msgs/Odometry    │ 位置/速度显示 │
│ /navigate_to_pose/_action/status │ action_msgs/...      │ 导航状态显示  │
│ /plan                            │ nav_msgs/Path        │ 路径显示(可选)│
└──────────────────────────────────┴─────────────────────┴──────────────┘

roslibjs 接入示例：
  const ros = new ROSLIB.Ros({ url: 'ws://machine-a:9090' })
  const odom = new ROSLIB.Topic({
    ros,
    name: '/odom',
    messageType: 'nav_msgs/Odometry'
  })
  odom.subscribe(msg => {
    // 更新界面上的位置/速度
  })
```

---

### 5.5 接口协议变更建议

> 以下字段建议在第一周对齐后保持稳定；如确需修改，建议三人同步知会并更新本文档版本号：
> - A → B 推送的 JSON 字段名和类型
> - B → C 返回的 JSON 字段名和类型
> - evidence_id 的格式（当前：E-\d+）
> - visible_to 的枚举值（当前：dev / test / ops）

---

## 附录 A：技术栈汇总

| 模块 | 技术栈 |
|------|--------|
| A - 仿真 | ROS2 Humble + TurtleBot3 + Nav2 + Gazebo（均源码 build） |
| A - 错误注入 | Gazebo spawn 服务 + ROS2 参数接口 + 自写注入脚本/节点（Python） |
| A - 静态分析 | Python + tree-sitter + tree-sitter-cpp |
| A - Agent | Python + rclpy（ROS2 Python 客户端） |
| A - 实时桥接 | rosbridge_server（WebSocket） |
| B - 后端框架 | FastAPI + uvicorn + SQLite |
| B - Agent | DeepSeek API + MCP SDK（Python，自实现 loop） |
| B - LLM | DeepSeek V4-Pro（OpenAI 兼容接口） |
| C - 前端框架 | React + TypeScript + Vite（UI 库由 C 同学第一周选定） |
| C - 候选 UI A | shadcn-admin + shadcn-chatbot-kit + TailwindCSS |
| C - 候选 UI B | Ant Design 5 + @ant-design/x（如需模板可用 Ant Design Pro） |
| C - 布局 | react-resizable-panels（三栏，两个候选均可用） |
| C - 实时接入 | roslibjs |
| C - 代码高亮 | react-syntax-highlighter |

---

## 附录 B：可参考的开源项目与资料

> 以下是可借鉴的开源项目与文献，方便各模块"少造轮子、多组装"。链接为公开仓库 / 论文，仅供参考，不代表必须采用。

### B.1 机器人数据采集与可视化（A、C 参考）

- **Foxglove** — 现代机器人数据可视化与调试平台，原生支持 ROS2 topic 与 rosbag/MCAP，提供 WebSocket/REST。它的"时间线 + 多面板"交互可作为 Tracero 三栏布局的设计灵感。https://foxglove.dev
- **Rerun** — 开源多模态时序数据可视化（点云/图像/曲线/张量），Rust + Python，启动轻量。https://github.com/rerun-io/rerun
- **PlotJuggler** — ROS 时序数据曲线分析工具，适合调试运行时数据。https://github.com/facontidavide/PlotJuggler
- **rosbridge_suite / roslibjs** — ROS 官方 WebSocket 桥与浏览器客户端库，C 接入实时状态直接用得上。https://github.com/RobotWebTools/rosbridge_suite ，https://github.com/RobotWebTools/roslibjs

### B.2 错误 / 故障注入（A 参考，对应"错误注入"职责）

- **面向自驾的策略性软件故障注入研究**（基于 openpilot，arXiv 1807.06172）— 给出"按危害分析驱动注入点"的方法，对 LiDAR/RADAR/相机做扰动，对设计 TC 注入很有参考价值。https://arxiv.org/abs/1807.06172
- **ROS2 无人机安全仿真框架**（arXiv 2410.03971）— 以独立 ROS2 节点形式实现 IMU/GPS/相机的传感器欺骗与注入，可借鉴"把每种注入封装成一个可插拔节点"的工程方式。https://arxiv.org/abs/2410.03971
- **FAIL\*（FAult Injection Leveraged）** — 系统级故障注入框架，了解 FI 的通用抽象与实验组织思路。https://github.com/danceos/fail

### B.3 证据驱动 / 引用忠实的 LLM（B 参考，对应 Evidence Builder + Verifier）

- **Citation-Grounded Code Comprehension**（arXiv 2512.12117）— 要求 LLM 引用具体 `文件:起止行` 并做**机械式校验**，与 Tracero 的 evidence_id 校验思路高度一致，值得 B 重点参考其 Verifier 设计。https://arxiv.org/abs/2512.12117
- **Verity（ICCL/Enforce）** — 据称首个以 MCP 形式组合多层校验、降低幻觉与伪造引用的开源工具，可参考其"用独立模型做交叉校验"的做法。
- **MCP-Bench** — 工具调用 agent 的评测基准，强调"答案需基于工具输出、可溯源"。https://openreview.net/pdf?id=2InRbaYve7
- **awesome-hallucination-detection** — 幻觉检测论文与方法清单，便于 B 系统性了解校验手段。https://github.com/EdinburghNLP/awesome-hallucination-detection

### B.4 代码静态分析（A 参考）

- **tree-sitter / tree-sitter-cpp** — 多语言增量解析器，GitHub 自家代码导航即基于它，扫 C++ 建消息映射索引的首选。https://tree-sitter.github.io/tree-sitter/

### B.5 Agent / 工具调用框架（B 参考）

- **OpenCode** — 终端式 AI 编码 agent（TUI、多模型、支持 MCP/LSP）。注意它偏 CLI 交互，建议 B **借鉴其 agent loop 思路**而非直接嵌入 FastAPI。https://github.com/opencode-ai/opencode
- **MCP Python SDK** — 模型上下文协议官方 SDK，B 的三个查询工具基于它实现。https://github.com/modelcontextprotocol/python-sdk

### B.6 前端模板与组件（C 参考）

- **shadcn-admin（satnaing）** — Vite + React + TS + shadcn/ui，约 11k stars，2026 年初仍活跃。注意其路由用 **TanStack Router**（文件式路由，需少量学习）。https://github.com/satnaing/shadcn-admin
- **shadcn-chatbot-kit** — shadcn 风格的对话/聊天组件，补齐 Chat 面板。
- **Ant Design Pro** — antd 官方开箱即用企业级模板（含布局、菜单、mock 与多种 List/Table 页），是"antd 也有完整模板"的选项，适合想要现成脚手架的同学。https://github.com/ant-design/ant-design-pro
- **@ant-design/x** — antd 官方 AI 对话组件（Bubble / Sender），与 antd 同一套设计语言。https://github.com/ant-design/x
- **react-resizable-panels** — 三栏可拖拽布局，两套 UI 方案都可用。https://github.com/bvaughn/react-resizable-panels
- **react-syntax-highlighter** — 证据面板里代码片段高亮。https://github.com/react-syntax-highlighter/react-syntax-highlighter

### B.7 被测系统与仿真基座（命题已列，备查）

- **Autoware Universe**（被测自驾系统）、**AWSIM**（Unity 仿真器）、**Nav2**（导航栈）、**TurtleBot3**、**ROS2 Humble**。
