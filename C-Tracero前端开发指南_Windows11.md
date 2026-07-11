# Tracero 前端开发指南
## Windows 11 · 从零开始

> 本文档面向没有前端开发经验的同学。目标是让你在一周内完成两件事：
> 1. 搞清楚前端是什么、怎么开发
> 2. 用两个框架各做一个 Tracero 最小 demo，选出你接下来要用的那个

---

## 目录

- [第 0 章：前端是什么——先建立基本认知](#第-0-章前端是什么先建立基本认知)
- [第 1 章：Windows 11 下搭建开发环境](#第-1-章windows-11-下搭建开发环境)
- [第 2 章：shadcn-admin 框架](#第-2-章shadcn-admin-框架)
- [第 3 章：Ant Design 5 框架](#第-3-章ant-design-5-框架)
- [第 4 章：用两个框架各实现最小 Tracero（3 个页面）](#第-4-章用两个框架各实现最小-tracero3-个页面)
- [附录：外部资源链接汇总](#附录外部资源链接汇总)

---

## 第 0 章：前端是什么——先建立基本认知

在动手之前，先把几个词搞清楚。不用死记硬背，大概知道它们各自负责什么就行。

### 前端 vs 后端

打开一个网页，你在浏览器里看到的那一切——导航栏、表格、按钮、颜色——都是**前端**负责的。前端代码跑在你的浏览器里，不需要服务器。

后端负责数据和逻辑：存数据库、做计算、响应请求。在 Tracero 里，B 同学写的 FastAPI 就是后端。

C 同学的工作就是前端：把 B 同学给的数据显示成漂亮的页面，让用户可以交互。

### JavaScript / TypeScript

浏览器能理解的编程语言叫 **JavaScript**（简称 JS）。

**TypeScript**（简称 TS）是在 JavaScript 上加了"类型"的版本，比如你可以写 `const name: string = "Tracero"`，明确说这个变量是字符串。它的好处是写错了 IDE 会提前报红，不用等到运行才发现问题。现代前端项目几乎都用 TypeScript。TS 文件以 `.ts` 或 `.tsx` 结尾，最终编译成普通 JS 给浏览器运行。

### React

**React** 是目前最主流的前端框架，由 Meta（Facebook）开发并开源。它的核心思想是**组件**：把页面拆成一个个小块，每块叫一个组件，组件可以复用。

比如 Tracero 的侧边栏是一个组件，事件表格是一个组件，视角下拉是一个组件，把它们拼在一起就成了一个页面。

一个最简单的 React 组件长这样：

```tsx
// 这是一个显示"你好"的组件
function Hello() {
  return <div>你好，Tracero！</div>
}
```

注意 JS/TS 里可以直接写像 HTML 一样的东西，这叫 **JSX**（或 TSX），React 会把它翻译成真正的 HTML。

### npm / pnpm

**npm** 是 Node.js 自带的包管理工具，用来安装别人写好的代码库（比如 React 本身、Ant Design 的组件库等）。

**pnpm** 是 npm 的替代品，速度更快、磁盘占用更少，现在很多项目用它。两者的命令很相似：

```
npm install antd      →    pnpm add antd
npm run dev           →    pnpm dev
```

本文统一用 pnpm。

### Vite

**Vite** 是一个构建工具，负责两件事：

1. **开发时**：启动一个本地服务器（通常是 `http://localhost:5173`），你改了代码，浏览器自动刷新，不需要手动重启。
2. **上线前**：把你的 TypeScript 代码打包压缩成浏览器能直接运行的文件。

你不需要深入了解 Vite 的内部，只要知道"跑 `pnpm dev` 就能看到页面"就够了。

### 一句话总结

> 你写 TypeScript + React 代码 → Vite 帮你在本地跑起来 → 浏览器显示页面 → 用 pnpm 安装需要的组件库

---

## 第 1 章：Windows 11 下搭建开发环境

这一章装好四个东西：**Node.js、pnpm、Git、VS Code**。全程在 Windows 原生环境下操作，不需要 WSL2 或 Docker。

### 1.1 安装 Node.js

Node.js 是运行 JavaScript/TypeScript 的运行时环境，pnpm 和 Vite 都需要它。

**步骤：**

1. 打开浏览器，访问 https://nodejs.org
2. 点击 **"LTS"** 那个绿色大按钮下载（LTS 是长期支持版，稳定）
3. 下载完毕后双击 `.msi` 安装包，一路点 Next，保持默认选项
4. 安装完成后，打开 **Windows PowerShell**（按 `Win + X`，选 "Windows PowerShell"）
5. 输入以下命令检查是否安装成功：

```powershell
node -v
npm -v
```

如果看到类似 `v22.x.x` 和 `10.x.x` 的版本号，说明安装成功了。

> **如果提示 "node 不是内部命令"**：关掉 PowerShell 重新打开，或者重启电脑，再试一次。

### 1.2 安装 pnpm

在 PowerShell 里输入：

```powershell
npm install -g pnpm
```

安装完成后验证：

```powershell
pnpm -v
```

看到版本号（比如 `9.x.x`）就成了。

### 1.3 安装 Git

Git 是代码版本管理工具，clone 项目要用它。

1. 访问 https://git-scm.com/download/win
2. 下载并安装，选项保持默认（全程 Next）
3. 安装完成后在 PowerShell 里验证：

```powershell
git -v
```

看到 `git version 2.x.x` 即成功。

### 1.4 安装 VS Code

VS Code 是你写代码的地方。

1. 访问 https://code.visualstudio.com
2. 点 **Download for Windows** 下载安装包
3. 安装时勾选 **"Add to PATH"** 和 **"Open with Code"** 两个选项（方便后续在 PowerShell 里直接用 `code .` 打开项目）

### 1.5 安装 VS Code 推荐扩展

打开 VS Code，按 `Ctrl + Shift + X` 打开扩展面板，搜索并安装以下扩展：

| 扩展名 | 用途 |
|--------|------|
| **ESLint** | 代码规范检查，写错了会有红线提示 |
| **Prettier - Code formatter** | 保存时自动格式化代码 |
| **Tailwind CSS IntelliSense** | 写 Tailwind 类名时有自动补全（shadcn 方案要用） |
| **ES7+ React/Redux/React-Native snippets** | 快速生成 React 代码片段 |
| **GitLens** | 查看 Git 历史，了解代码谁改的 |

安装方法：在扩展面板搜索名字，点 Install。

---

## 第 2 章：shadcn-admin 框架

### 2.1 框架介绍

**shadcn-admin** 是一个基于 shadcn/ui 组件库的开源管理后台模板，由开发者 satnaing 维护，GitHub 上有约 11,000 stars（2026 年初数据），社区活跃。

**技术栈：**

| 技术 | 是什么 |
|------|--------|
| React 18 | 前端框架 |
| TypeScript | 语言 |
| Vite | 构建工具 |
| shadcn/ui | 组件库（Radix UI + TailwindCSS 实现） |
| TailwindCSS | CSS 样式框架，用类名代替写 CSS |
| TanStack Router | 路由库（管理"哪个 URL 显示哪个页面"） |

**shadcn/ui 的特别之处：** 和大多数组件库（安装后直接 import 用）不同，shadcn/ui 是把组件源码直接复制进你的项目，代码在你手里。改样式不受组件库版本限制，自由度很高，但也意味着初学者需要适应"代码都在本地"的方式。

**优点：**
- 界面美观，默认风格现代、干净
- 可以深度定制样式
- 有完整的管理后台模板，不需要从零搭布局
- 社区组件生态丰富（包括 Chat 组件）

**缺点：**
- TailwindCSS 的类名写法对新手不直觉（比如 `className="flex items-center gap-4 rounded-lg p-3"`）
- TanStack Router 的文件式路由需要额外理解
- 英文文档为主，中文资料相对少

**适合 Tracero 的地方：** 有现成的 shadcn-chatbot-kit 可以直接实现 Chat 面板，三栏布局配合 react-resizable-panels 也有现成参考。

### 2.2 在线 Demo 体验

打开浏览器访问：**https://shadcn-admin.netlify.app**

建议重点点击以下页面：
- **Dashboard**：看整体布局风格，左侧导航 + 右侧内容区
- **Users**（或 Tasks）：看表格页，这是 Tracero 历史记录页的参考
- 注意顶部的主题切换按钮：可以切换亮色/暗色模式

### 2.3 把 shadcn-admin 在本地跑起来

打开 PowerShell，找一个你想存放代码的位置（比如 `C:\Users\你的用户名\projects`），依次执行：

```powershell
# 新建 projects 文件夹并进入（如果已有可跳过）
mkdir C:\Users\你的用户名\projects
cd C:\Users\你的用户名\projects

# clone 项目（--depth=1 只下载最新版本，速度快）
git clone https://github.com/satnaing/shadcn-admin.git --depth=1

# 进入项目文件夹
cd shadcn-admin

# 安装依赖（会下载 node_modules，首次需要 1-3 分钟）
pnpm install

# 启动开发服务器
pnpm dev
```

看到类似下面的输出说明成功了：

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

打开浏览器访问 `http://localhost:5173`，就能看到本地运行的 shadcn-admin 了。

> **停止服务**：在 PowerShell 里按 `Ctrl + C`。

### 2.4 用 VS Code 打开项目并浏览代码

在 PowerShell 里（确保在 shadcn-admin 目录下）执行：

```powershell
code .
```

VS Code 会打开这个项目。左边文件树里重点看几个位置：

```
shadcn-admin/
├── src/
│   ├── routes/          ← 每个文件对应一个页面（TanStack Router 的文件式路由）
│   │   ├── index.tsx    ← 首页
│   │   ├── tasks/       ← tasks 相关页面
│   │   └── users/       ← users 相关页面
│   ├── components/      ← 可复用的组件
│   │   ├── ui/          ← shadcn/ui 组件（Button、Table、Select 等）
│   │   └── layout/      ← 布局组件（侧边栏、顶栏等）
│   └── main.tsx         ← 入口文件
├── package.json         ← 项目配置和依赖列表
└── tailwind.config.js   ← TailwindCSS 配置
```

### 2.5 Hello World：在 shadcn-admin 里新加一个页面

下面演示如何在 shadcn-admin 模板里新增一个简单页面。

**第一步：新建页面文件**

在 `src/routes/` 下新建文件 `hello.tsx`（在 VS Code 里右键 routes 文件夹 → New File）：

```tsx
// src/routes/hello.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hello')({
  component: HelloPage,
})

function HelloPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">你好，Tracero！</h1>
      <p className="text-gray-600">这是我的第一个页面。</p>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-blue-800">
          这个蓝色框是用 TailwindCSS 的类名做出来的，
          不需要单独写 CSS 文件。
        </p>
      </div>
    </div>
  )
}
```

**第二步：在侧边栏加上导航入口**

打开 `src/components/layout/app-sidebar.tsx`（或类似名称的侧边栏文件），找到 navMain 数组，加上一项：

```tsx
// 在 navMain 数组里加一条（仿照已有的格式）
{
  title: "Hello",
  url: "/hello",
  icon: IconLayoutDashboard, // 随便用一个已有的图标
},
```

> 如果找不到确切的位置，在 VS Code 里按 `Ctrl + F` 搜索 `navMain`，就能定位到。

**第三步：保存并查看**

保存文件（`Ctrl + S`），浏览器会自动刷新。点击侧边栏里新出现的 "Hello" 就能看到你的新页面了。

这就是 shadcn-admin 的开发方式：**新建一个文件 = 新增一个页面**，侧边栏手动加一条入口。

---

## 第 3 章：Ant Design 5 框架

### 3.1 框架介绍

**Ant Design**（简称 antd）是阿里巴巴开源的企业级 UI 组件库，GitHub 上有超过 93,000 stars，是全球使用量最大的 React 组件库之一。

**技术栈：**

| 技术 | 是什么 |
|------|--------|
| React 18 | 前端框架 |
| TypeScript | 语言 |
| Vite | 构建工具 |
| Ant Design 5 | 组件库（自带样式，不需要 TailwindCSS） |

**antd 的特别之处：** 组件自带完整样式，直接 import 用，就像使用现成的积木一样。文档全面，中文支持极好（官网有完整中文版）。

**优点：**
- **对新手最友好**：每个组件的文档页面都有完整的可运行示例，可以直接复制代码
- **中文文档**：官网 https://ant.design/components/overview-cn 所有内容都有中文
- 企业级组件齐全：Table、Form、Layout、Menu、Select 等应有尽有
- 有 @ant-design/x 专门提供 AI 对话组件（Bubble、Sender），适合 Chat 面板

**缺点：**
- 默认样式偏"正式/传统"，和 shadcn-admin 的现代风格相比略显陈旧
- 高度定制样式比 shadcn 麻烦一些（需要通过 ConfigProvider 覆盖）
- 包体积较大（不过 Vite 会做 tree-shaking，实际影响不大）

**适合 Tracero 的地方：** antd 的 Table、Layout、Select 开箱即用，适合快速搭出功能完整的界面。@ant-design/x 里的 Bubble 和 Sender 组件直接对应 Tracero 的 Chat 面板需求。

### 3.2 在线 Demo 体验

打开浏览器访问：**https://antd-multipurpose-dashboard.netlify.app**

这是一个基于 Vite + React + Ant Design 5 做的完整后台，可以看到：
- 左侧折叠/展开的导航侧边栏
- Dashboard 的各种数据卡片
- 表格页（有搜索、筛选、分页）

另外也可以看官方的组件预览，直接在组件文档页点击示例交互：**https://ant.design/components/table-cn**（Table 组件页面，下方有很多可交互的示例）

### 3.3 从零新建一个 Ant Design 5 项目

打开 PowerShell，进入你的 projects 目录：

```powershell
cd C:\Users\你的用户名\projects

# 用 Vite 模板创建 React + TypeScript 项目
pnpm create vite tracero-antd --template react-ts

# 进入项目
cd tracero-antd

# 安装基础依赖
pnpm install

# 安装 Ant Design 5
pnpm add antd

# 安装路由库（用于多页面切换）
pnpm add react-router-dom
```

安装完成后启动：

```powershell
pnpm dev
```

浏览器打开 `http://localhost:5173`，能看到 Vite 默认的白色页面，说明项目跑通了。

### 3.4 Hello World：用 Ant Design 写一个完整页面

下面把默认页面改成一个用 antd 组件拼出来的示例页面。

**第一步：替换入口样式**

打开 `src/index.css`，把里面的内容全部删掉替换成：

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

**第二步：替换主应用文件**

打开 `src/App.tsx`，把全部内容替换成：

```tsx
import { Layout, Menu, Table, Select, Card, Tag } from 'antd'
import type { MenuProps, TableProps } from 'antd'
import {
  DashboardOutlined,
  UnorderedListOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import 'antd/dist/reset.css'

const { Header, Sider, Content } = Layout

// 侧边栏菜单项
const menuItems: MenuProps['items'] = [
  {
    key: 'dashboard',
    icon: <DashboardOutlined />,
    label: '总览',
  },
  {
    key: 'current',
    icon: <UnorderedListOutlined />,
    label: '当前推理',
  },
  {
    key: 'history',
    icon: <HistoryOutlined />,
    label: '历史记录',
  },
]

// 表格列定义
const columns: TableProps['columns'] = [
  {
    title: '时间',
    dataIndex: 'time',
    key: 'time',
  },
  {
    title: '事件类型',
    dataIndex: 'eventType',
    key: 'eventType',
  },
  {
    title: '摘要',
    dataIndex: 'summary',
    key: 'summary',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={status === '推理中' ? 'orange' : 'green'}>
        {status}
      </Tag>
    ),
  },
]

// 假数据
const tableData = [
  { key: '1', time: '14:32', eventType: '导航失败', summary: 'costmap 更新延迟', status: '推理中' },
  { key: '2', time: '13:15', eventType: '急停触发', summary: '速度异常', status: '已完成' },
  { key: '3', time: '11:08', eventType: '路径重规划', summary: '目标不可达', status: '已完成' },
]

export default function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 左侧边栏 */}
      <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px 24px', fontWeight: 'bold', fontSize: 16, borderBottom: '1px solid #f0f0f0' }}>
          🤖 Tracero
        </div>
        <Menu
          mode="inline"
          defaultSelectedKeys={['dashboard']}
          items={menuItems}
          style={{ border: 'none' }}
        />
      </Sider>

      {/* 右侧主区域 */}
      <Layout>
        {/* 顶栏 */}
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <span style={{ fontWeight: 600 }}>总览</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#666' }}>视角：</span>
            <Select
              defaultValue="dev"
              style={{ width: 120 }}
              options={[
                { value: 'dev', label: '开发' },
                { value: 'test', label: '测试' },
                { value: 'ops', label: '运营' },
              ]}
              onChange={(value) => console.log('切换视角：', value)}
            />
          </div>
        </Header>

        {/* 内容区 */}
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          {/* 统计卡片 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <Card style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#fa8c16' }}>1</div>
              <div style={{ color: '#666', marginTop: 4 }}>推理中</div>
            </Card>
            <Card style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#52c41a' }}>5</div>
              <div style={{ color: '#666', marginTop: 4 }}>已完成</div>
            </Card>
            <Card style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#ff4d4f' }}>0</div>
              <div style={{ color: '#666', marginTop: 4 }}>失败</div>
            </Card>
          </div>

          {/* 最近事件表格 */}
          <Card title="最近事件">
            <Table
              columns={columns}
              dataSource={tableData}
              pagination={false}
            />
          </Card>
        </Content>
      </Layout>
    </Layout>
  )
}
```

**第三步：安装图标库**

antd 的图标需要单独安装：

```powershell
pnpm add @ant-design/icons
```

安装好后保存所有文件，浏览器会自动刷新，你能看到一个带侧边栏、顶栏统计卡片和表格的页面。

**这就是 antd 的开发方式：** 直接 import 组件用，属性和样式通过 props 传进去，不需要写一行 CSS。

---

## 第 4 章：用两个框架各实现最小 Tracero（3 个页面）

### 4.1 三个页面的设计

Tracero 最小 demo 包含三个页面，所有数据都用假数据（不接任何真实 API）。

---

**页面 1：总览（Dashboard）**

第一眼进来能看到系统整体状态。

```
┌──────────────────────────────────────────────────────────┐
│  🤖 Tracero                        视角: [开发 ▾]       │
├────────┬─────────────────────────────────────────────────┤
│        │                                                 │
│  导航   │   ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│        │   │  推理中 1  │  │  已完成 5  │  │   失败  0  │  │
│ ● 总览  │   └───────────┘  └───────────┘  └───────────┘  │
│ ○ 当前  │                                                │
│ ○ 历史  │   最近事件                                      │
│        │   ┌──────┬──────────┬───────────┬──────┐        │
│        │   │ 时间  │ 类型      │ 摘要       │ 状态  │        │
│        │   ├──────┼──────────┼───────────┼──────┤        │
│        │   │14:32 │ 导航失败  │ costmap异常│推理中 │        │
│        │   │13:15 │ 急停触发  │ 速度异常   │已完成 │        │
│        │   │11:08 │ 路径重规划│ 目标不可达 │已完成 │        │
│        │   └──────┴──────────┴───────────┴──────┘        │
│        │                                                 │
└────────┴─────────────────────────────────────────────────┘
```

---

**页面 2：当前推理**

上半部分显示 AI 的三段式结论，下半部分是 Chat 对话框。

```
┌──────────────────────────────────────────────────────────┐
│  🤖 Tracero                        视角: [开发 ▾]       │
├────────┬─────────────────────────────────────────────────┤
│        │  🔴 导航失败  14:32:07          状态: 推理中    │
│  导航   │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│        │                                                 │
│ ○ 总览  │  ● 事实                                        │
│ ● 当前  │    costmap 更新延迟 340ms [E-03]               │
│ ○ 历史  │                                                │
│        │  ● 推理                                         │
│        │    controller_server.cpp:387 使用旧地图数据      │
│        │    障碍物信息未传达至规划模块 [E-02]             │
│        │                                                 │
│        │  ● 建议                                         │
│        │    调低 update_frequency 或提升 LiDAR 频率      │
│        │                                                 │
│        │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│        │                                                 │
│        │  🧑 inflation_radius 在哪定义的？               │
│        │  🤖 定义在 nav2_params.yaml 第 45 行，值 0.55  │
│        │                                                 │
│        │  ┌──────────────────────────────────┬────┐     │
│        │  │ 输入问题...                        │发送│     │
│        │  └──────────────────────────────────┴────┘     │
└────────┴─────────────────────────────────────────────────┘
```

---

**页面 3：历史记录**

一个纯展示的表格，列出历史事件，不需要交互。

```
┌──────────────────────────────────────────────────────────┐
│  🤖 Tracero                        视角: [开发 ▾]       │
├────────┬─────────────────────────────────────────────────┤
│        │  历史事件                                       │
│  导航   │  ┌──────┬──────────┬───────────────┬──────┐    │
│        │  │ 时间  │ 类型      │ 摘要           │ 状态  │    │
│ ○ 总览  │  ├──────┼──────────┼───────────────┼──────┤    │
│ ○ 当前  │  │13:15 │ 急停触发  │ 速度异常        │ ✅   │    │
│ ● 历史  │  │11:08 │ 路径重规划│ 目标不可达      │ ✅   │    │
│        │  │09:44 │ 导航失败  │ 传感器丢帧      │ ✅   │    │
│        │  │昨天   │ 参数异常  │ inflation 过小  │ ✅   │    │
│        │  └──────┴──────────┴───────────────┴──────┘    │
│        │                                                 │
└────────┴─────────────────────────────────────────────────┘
```

---

### 4.2 Mock 数据准备

两个框架方案共用同一份假数据，新建 `mockData.ts` 文件。数据结构按照 B 同学未来 API 的字段名设计，这样后期联调只需替换数据来源，不用改页面代码。

```typescript
// mockData.ts
// 三个统计数字（页面 1 用）
export const stats = {
  reasoning: 1,   // 推理中
  completed: 5,   // 已完成
  failed: 0,      // 失败
}

// 所有事件的列表（页面 1 和页面 3 用）
export const runs = [
  {
    run_id: 'run_20260527_143207',
    event_type: '导航失败',
    trigger_time: '14:32:07',
    status: 'reasoning',       // reasoning = 推理中
    summary: 'costmap 更新延迟导致导航失败',
  },
  {
    run_id: 'run_20260527_131544',
    event_type: '急停触发',
    trigger_time: '13:15:44',
    status: 'done',
    summary: '速度异常导致急停',
  },
  {
    run_id: 'run_20260527_110821',
    event_type: '路径重规划',
    trigger_time: '11:08:21',
    status: 'done',
    summary: '目标点不可达，重新规划路径',
  },
  {
    run_id: 'run_20260526_094412',
    event_type: '导航失败',
    trigger_time: '昨天 09:44',
    status: 'done',
    summary: '传感器丢帧导致定位偏差',
  },
  {
    run_id: 'run_20260526_083001',
    event_type: '参数异常',
    trigger_time: '昨天 08:30',
    status: 'done',
    summary: 'inflation_radius 设置过小，路径规划失败',
  },
]

// 当前正在推理的事件详情（页面 2 用）
export const currentRun = {
  run_id: 'run_20260527_143207',
  event_type: '导航失败',
  trigger_time: '14:32:07',
  status: 'reasoning',
  // AI 三段式结论
  conclusion: {
    fact: 'costmap 更新延迟 340ms，障碍物出现时局部代价地图未能及时更新 [E-03]',
    reasoning:
      'controller_server.cpp 第 387 行 [E-02] 在生成速度指令时读取的是 340ms 前的旧地图，障碍物信息未传达至规划模块，导致未能刹车',
    suggestion:
      '建议将 update_frequency 从 5.0 Hz 调高到 10.0 Hz，或排查 LiDAR 数据传输延迟原因',
  },
  // Chat 对话历史（写死的假数据，模拟已经追问过几次）
  chatHistory: [
    {
      role: 'user',
      content: 'inflation_radius 在哪定义的？',
    },
    {
      role: 'ai',
      content:
        'inflation_radius 定义在 nav2_params.yaml 第 45 行，当前值为 0.55。这个参数控制障碍物膨胀半径，影响路径规划时对障碍物的避让距离。',
    },
    {
      role: 'user',
      content: 'update_frequency 现在是多少？',
    },
    {
      role: 'ai',
      content:
        'update_frequency 当前值为 5.0（Hz），定义在 nav2_params.yaml 第 23 行。这意味着局部代价地图每 200ms 更新一次，在高速场景下可能出现更新延迟。',
    },
  ],
}

// 视角标签的中文名
export const roleLabels: Record<string, string> = {
  dev: '开发',
  test: '测试',
  ops: '运营',
}
```

> 以上数据可直接复制粘贴使用。后期接入 B 同学的 API 时，只需把 `import { runs } from './mockData'` 换成 `fetch('/api/runs')` 即可，页面本身不用改。

---

### 4.3 Ant Design 5 方案：3 页 Tracero

在第 3 章建好的 `tracero-antd` 项目基础上继续开发。

**项目结构规划：**

```
tracero-antd/
├── src/
│   ├── mockData.ts        ← 把上面的假数据放这里
│   ├── pages/
│   │   ├── Dashboard.tsx  ← 页面 1：总览
│   │   ├── CurrentRun.tsx ← 页面 2：当前推理
│   │   └── History.tsx    ← 页面 3：历史记录
│   ├── App.tsx            ← 主布局 + 路由
│   ├── main.tsx           ← 入口（不用改）
│   └── index.css          ← 全局样式
└── package.json
```

**第一步：创建 mockData.ts**

在 `src/` 下新建 `mockData.ts`，把 4.2 节的内容全部粘贴进去。

**第二步：新建 pages 文件夹**

在 `src/` 下新建文件夹 `pages`，然后创建以下三个文件：

---

**`src/pages/Dashboard.tsx`**（页面 1，总览）

```tsx
import { Card, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { stats, runs } from '../mockData'

// 表格列定义
const columns: TableProps['columns'] = [
  {
    title: '时间',
    dataIndex: 'trigger_time',
    key: 'trigger_time',
    width: 100,
  },
  {
    title: '事件类型',
    dataIndex: 'event_type',
    key: 'event_type',
    width: 120,
  },
  {
    title: '摘要',
    dataIndex: 'summary',
    key: 'summary',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    render: (status: string) => (
      <Tag color={status === 'reasoning' ? 'orange' : 'green'}>
        {status === 'reasoning' ? '推理中' : '已完成'}
      </Tag>
    ),
  },
]

export default function Dashboard() {
  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>系统总览</h2>

      {/* 三个统计卡片 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Card style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fa8c16' }}>
            {stats.reasoning}
          </div>
          <div style={{ color: '#666', marginTop: 8 }}>推理中</div>
        </Card>
        <Card style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a' }}>
            {stats.completed}
          </div>
          <div style={{ color: '#666', marginTop: 8 }}>已完成</div>
        </Card>
        <Card style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff4d4f' }}>
            {stats.failed}
          </div>
          <div style={{ color: '#666', marginTop: 8 }}>失败</div>
        </Card>
      </div>

      {/* 最近事件列表 */}
      <Card title="最近事件">
        <Table
          columns={columns}
          dataSource={runs.map((r) => ({ ...r, key: r.run_id }))}
          pagination={false}
        />
      </Card>
    </div>
  )
}
```

---

**`src/pages/CurrentRun.tsx`**（页面 2，当前推理）

```tsx
import { useState } from 'react'
import { Card, Input, Button, Tag, Divider } from 'antd'
import { SendOutlined } from '@ant-design/icons'
import { currentRun } from '../mockData'

// 聊天消息的类型
type ChatMessage = {
  role: 'user' | 'ai'
  content: string
}

export default function CurrentRun() {
  // 用 useState 管理对话列表，初始值是 mockData 里的历史记录
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(
    currentRun.chatHistory as ChatMessage[]
  )
  // 输入框里的文字
  const [inputValue, setInputValue] = useState('')
  // 是否正在"等待 AI 回复"（模拟加载状态）
  const [isLoading, setIsLoading] = useState(false)

  // 点击"发送"时触发
  function handleSend() {
    if (!inputValue.trim()) return

    // 把用户输入加进对话列表
    const userMsg: ChatMessage = { role: 'user', content: inputValue }
    setChatHistory((prev) => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)

    // 模拟 AI 回复（1.5 秒后出现假回复）
    setTimeout(() => {
      const aiMsg: ChatMessage = {
        role: 'ai',
        content:
          '（这是模拟回复）根据当前证据，这个问题与 costmap 更新机制有关。' +
          '具体参数定义在 nav2_params.yaml 中，建议检查 update_frequency 配置。',
      }
      setChatHistory((prev) => [...prev, aiMsg])
      setIsLoading(false)
    }, 1500)
  }

  // 按 Enter 键也能发送
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const { conclusion } = currentRun

  return (
    <div>
      {/* 事件标题栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Tag color="red">● 导航失败</Tag>
        <span style={{ color: '#666' }}>{currentRun.trigger_time}</span>
        <Tag color="orange">推理中</Tag>
      </div>

      {/* AI 三段式结论 */}
      <Card title="AI 推理结论" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#1677ff', marginBottom: 8 }}>● 事实</div>
          <div style={{ paddingLeft: 16, color: '#333', lineHeight: 1.8 }}>
            {conclusion.fact}
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, color: '#fa8c16', marginBottom: 8 }}>● 推理</div>
          <div style={{ paddingLeft: 16, color: '#333', lineHeight: 1.8 }}>
            {conclusion.reasoning}
          </div>
        </div>

        <Divider style={{ margin: '12px 0' }} />

        <div>
          <div style={{ fontWeight: 600, color: '#52c41a', marginBottom: 8 }}>● 建议</div>
          <div style={{ paddingLeft: 16, color: '#333', lineHeight: 1.8 }}>
            {conclusion.suggestion}
          </div>
        </div>
      </Card>

      {/* Chat 对话区 */}
      <Card title="追问 AI">
        {/* 对话历史 */}
        <div
          style={{
            minHeight: 200,
            maxHeight: 320,
            overflowY: 'auto',
            marginBottom: 16,
            padding: '8px 0',
          }}
        >
          {chatHistory.map((msg, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: '75%',
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: msg.role === 'user' ? '#1677ff' : '#f5f5f5',
                  color: msg.role === 'user' ? '#fff' : '#333',
                  lineHeight: 1.7,
                }}
              >
                {msg.role === 'ai' && (
                  <div style={{ fontWeight: 600, marginBottom: 4, color: '#999', fontSize: 12 }}>
                    🤖 AI
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ color: '#999', fontSize: 14, padding: '4px 0' }}>
              🤖 AI 正在思考...
            </div>
          )}
        </div>

        {/* 输入框 */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，按 Enter 发送..."
            disabled={isLoading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  )
}
```

---

**`src/pages/History.tsx`**（页面 3，历史记录）

```tsx
import { Card, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { runs } from '../mockData'

// 只显示已完成的历史事件（过滤掉推理中的）
const historyRuns = runs.filter((r) => r.status === 'done')

const columns: TableProps['columns'] = [
  {
    title: '时间',
    dataIndex: 'trigger_time',
    key: 'trigger_time',
    width: 140,
  },
  {
    title: '事件类型',
    dataIndex: 'event_type',
    key: 'event_type',
    width: 120,
  },
  {
    title: '摘要',
    dataIndex: 'summary',
    key: 'summary',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: () => <Tag color="green">✅ 已完成</Tag>,
  },
]

export default function History() {
  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>历史记录</h2>
      <Card>
        <Table
          columns={columns}
          dataSource={historyRuns.map((r) => ({ ...r, key: r.run_id }))}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  )
}
```

---

**第三步：改写 `App.tsx`（主布局 + 路由）**

```tsx
import { useState } from 'react'
import { Layout, Menu, Select } from 'antd'
import type { MenuProps } from 'antd'
import {
  DashboardOutlined,
  SyncOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import 'antd/dist/reset.css'

import Dashboard from './pages/Dashboard'
import CurrentRun from './pages/CurrentRun'
import History from './pages/History'
import { roleLabels } from './mockData'

const { Header, Sider, Content } = Layout

// 菜单项
const menuItems: MenuProps['items'] = [
  { key: 'dashboard', icon: <DashboardOutlined />, label: '总览' },
  { key: 'current',   icon: <SyncOutlined />,      label: '当前推理' },
  { key: 'history',   icon: <HistoryOutlined />,    label: '历史记录' },
]

// 菜单 key → 页面标题
const pageTitles: Record<string, string> = {
  dashboard: '总览',
  current:   '当前推理',
  history:   '历史记录',
}

export default function App() {
  // 当前选中的菜单项（控制显示哪个页面）
  const [activePage, setActivePage] = useState('dashboard')
  // 当前选择的视角
  const [role, setRole] = useState('dev')

  // 根据 activePage 返回对应的页面组件
  function renderPage() {
    if (activePage === 'dashboard') return <Dashboard />
    if (activePage === 'current')   return <CurrentRun />
    if (activePage === 'history')   return <History />
    return null
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 左侧边栏 */}
      <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div
          style={{
            padding: '16px 24px',
            fontWeight: 'bold',
            fontSize: 16,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          🤖 Tracero
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activePage]}
          items={menuItems}
          style={{ border: 'none', marginTop: 8 }}
          onClick={({ key }) => setActivePage(key)}
        />
      </Sider>

      {/* 右侧区域 */}
      <Layout>
        {/* 顶栏 */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: 56,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 16 }}>
            {pageTitles[activePage]}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#666', fontSize: 14 }}>视角：</span>
            <Select
              value={role}
              style={{ width: 110 }}
              options={Object.entries(roleLabels).map(([v, l]) => ({
                value: v,
                label: l,
              }))}
              onChange={(value) => {
                setRole(value)
                console.log('切换视角：', roleLabels[value])
              }}
            />
          </div>
        </Header>

        {/* 页面内容 */}
        <Content style={{ padding: 24, background: '#f5f5f5', minHeight: 'calc(100vh - 56px)' }}>
          {renderPage()}
        </Content>
      </Layout>
    </Layout>
  )
}
```

**第四步：启动并查看**

```powershell
pnpm dev
```

打开 `http://localhost:5173`，点击左侧导航可以在三个页面之间切换，右上角可以切换视角（目前只打印 console，视角过滤功能可以后续扩展），页面 2 的 Chat 框可以输入问题并收到假回复。

---

### 4.4 shadcn-admin 方案：3 页 Tracero

在第 2 章 clone 下来的 `shadcn-admin` 项目基础上继续开发。这个方案复用 shadcn-admin 已有的布局框架（侧边栏、顶栏都已经做好了），只需要新增三个页面文件。

**第一步：把 mockData.ts 放进项目**

在 `shadcn-admin/src/` 下新建 `mockData.ts`，把 4.2 节的内容全部粘贴进去。

**第二步：安装需要的额外包**

```powershell
cd shadcn-admin
pnpm add @tanstack/react-router
```

（shadcn-admin 已经用 TanStack Router，这里确认已安装即可）

**第三步：新建三个页面文件**

在 `src/routes/` 下新建文件夹 `tracero/`，然后创建以下文件：

---

**`src/routes/tracero/dashboard.tsx`**（页面 1，总览）

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { stats, runs } from '../../mockData'

export const Route = createFileRoute('/tracero/dashboard')({
  component: TraceroDashboard,
})

function TraceroDashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">系统总览</h1>

      {/* 三个统计卡片 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <div className="text-4xl font-bold text-orange-500">{stats.reasoning}</div>
          <div className="mt-2 text-sm text-gray-500">推理中</div>
        </div>
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <div className="text-4xl font-bold text-green-500">{stats.completed}</div>
          <div className="mt-2 text-sm text-gray-500">已完成</div>
        </div>
        <div className="rounded-lg border bg-white p-6 text-center shadow-sm">
          <div className="text-4xl font-bold text-red-500">{stats.failed}</div>
          <div className="mt-2 text-sm text-gray-500">失败</div>
        </div>
      </div>

      {/* 最近事件表格 */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="border-b px-6 py-4 font-medium">最近事件</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-6 py-3 font-medium">时间</th>
              <th className="px-6 py-3 font-medium">事件类型</th>
              <th className="px-6 py-3 font-medium">摘要</th>
              <th className="px-6 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.run_id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-500">{run.trigger_time}</td>
                <td className="px-6 py-4 font-medium">{run.event_type}</td>
                <td className="px-6 py-4 text-gray-600">{run.summary}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      run.status === 'reasoning'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {run.status === 'reasoning' ? '推理中' : '已完成'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

**`src/routes/tracero/current.tsx`**（页面 2，当前推理）

```tsx
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { currentRun } from '../../mockData'

export const Route = createFileRoute('/tracero/current')({
  component: TraceroCurrent,
})

type ChatMessage = { role: 'user' | 'ai'; content: string }

function TraceroCurrent() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(
    currentRun.chatHistory as ChatMessage[]
  )
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleSend() {
    if (!inputValue.trim()) return
    setChatHistory((prev) => [...prev, { role: 'user', content: inputValue }])
    setInputValue('')
    setIsLoading(true)
    setTimeout(() => {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'ai',
          content:
            '（模拟回复）根据当前证据，这个问题与 costmap 更新机制有关。建议检查 update_frequency 配置项。',
        },
      ])
      setIsLoading(false)
    }, 1500)
  }

  const { conclusion } = currentRun

  return (
    <div className="p-6 space-y-6">
      {/* 事件标题 */}
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
          ● 导航失败
        </span>
        <span className="text-sm text-gray-500">{currentRun.trigger_time}</span>
        <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
          推理中
        </span>
      </div>

      {/* AI 三段式结论 */}
      <div className="rounded-lg border bg-white p-6 shadow-sm space-y-5">
        <h2 className="font-semibold text-gray-800">AI 推理结论</h2>

        <div>
          <div className="mb-2 text-sm font-semibold text-blue-600">● 事实</div>
          <p className="pl-4 text-sm text-gray-700 leading-relaxed">{conclusion.fact}</p>
        </div>

        <hr className="border-gray-100" />

        <div>
          <div className="mb-2 text-sm font-semibold text-orange-500">● 推理</div>
          <p className="pl-4 text-sm text-gray-700 leading-relaxed">{conclusion.reasoning}</p>
        </div>

        <hr className="border-gray-100" />

        <div>
          <div className="mb-2 text-sm font-semibold text-green-600">● 建议</div>
          <p className="pl-4 text-sm text-gray-700 leading-relaxed">{conclusion.suggestion}</p>
        </div>
      </div>

      {/* Chat 对话区 */}
      <div className="rounded-lg border bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-gray-800">追问 AI</h2>

        {/* 对话历史 */}
        <div className="mb-4 max-h-72 min-h-40 overflow-y-auto space-y-3">
          {chatHistory.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] rounded-lg px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.role === 'ai' && (
                  <div className="mb-1 text-xs text-gray-400">🤖 AI</div>
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="text-sm text-gray-400">🤖 AI 正在思考...</div>
          )}
        </div>

        {/* 输入框 */}
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder="输入问题，按 Enter 发送..."
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

**`src/routes/tracero/history.tsx`**（页面 3，历史记录）

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { runs } from '../../mockData'

export const Route = createFileRoute('/tracero/history')({
  component: TraceroHistory,
})

const historyRuns = runs.filter((r) => r.status === 'done')

function TraceroHistory() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">历史记录</h1>

      <div className="rounded-lg border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-6 py-3 font-medium">时间</th>
              <th className="px-6 py-3 font-medium">事件类型</th>
              <th className="px-6 py-3 font-medium">摘要</th>
              <th className="px-6 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>
            {historyRuns.map((run) => (
              <tr key={run.run_id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-6 py-4 text-gray-500">{run.trigger_time}</td>
                <td className="px-6 py-4 font-medium">{run.event_type}</td>
                <td className="px-6 py-4 text-gray-600">{run.summary}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                    ✅ 已完成
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

---

**第四步：把三个页面加入侧边栏导航**

打开 shadcn-admin 里的侧边栏配置文件（通常是 `src/components/layout/app-sidebar.tsx` 或 `src/data/sidelinks.tsx`，在 VS Code 里用 `Ctrl + P` 搜索 `sidebar` 定位）。

找到导航数组，参考已有的格式加入三条：

```tsx
// 在已有的 navMain 或 sidelinks 数组里增加（模仿已有格式）
{
  title: 'Tracero 总览',
  url: '/tracero/dashboard',
  icon: IconLayoutDashboard,
},
{
  title: '当前推理',
  url: '/tracero/current',
  icon: IconRefresh,
},
{
  title: '历史记录',
  url: '/tracero/history',
  icon: IconHistory,
},
```

> 图标名称以 shadcn-admin 里已有的为准，用 `Ctrl + F` 搜索 `icon:` 看看有哪些可用的。

**第五步：在顶栏加上视角下拉**

打开顶栏组件（搜索 `header` 找到对应文件），在右侧加上：

```tsx
// 用 shadcn/ui 的 Select 组件
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// 在顶栏右侧放：
<div className="flex items-center gap-2">
  <span className="text-sm text-gray-500">视角：</span>
  <Select defaultValue="dev" onValueChange={(v) => console.log('切换视角：', v)}>
    <SelectTrigger className="w-28">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="dev">开发</SelectItem>
      <SelectItem value="test">测试</SelectItem>
      <SelectItem value="ops">运营</SelectItem>
    </SelectContent>
  </Select>
</div>
```

**第六步：启动并查看**

```powershell
pnpm dev
```

打开 `http://localhost:5173`，侧边栏里可以看到 Tracero 相关的三个页面入口。

---

### 4.5 对比与选择建议

做完两个方案之后，可以从下面几个维度对比感受：

| 维度 | Ant Design 5 | shadcn-admin |
|------|-------------|-------------|
| **上手速度** | 快，组件 import 即用，中文文档 | 稍慢，需适应 Tailwind 类名和文件路由 |
| **文档质量** | ⭐⭐⭐⭐⭐ 中文全面 | ⭐⭐⭐ 英文为主，shadcn/ui 文档较好 |
| **默认界面风格** | 偏传统商务 | 更现代清爽 |
| **布局灵活度** | 需要手写 style | Tailwind 类名组合，稍灵活 |
| **Chat 组件** | @ant-design/x 有现成 Bubble + Sender | shadcn-chatbot-kit 有现成 Chat 组件 |
| **三栏布局** | 手动写 flex 布局 | react-resizable-panels（两者都一样） |
| **定制样式** | ConfigProvider 主题配置 | 直接改 Tailwind 类名，更直接 |

**给 Tracero 项目的具体建议：**

如果你做完两个 demo 之后：
- 觉得 antd 的中文文档让你查问题更顺畅，写起来更有成就感 → 选 antd 路线
- 觉得 shadcn 的界面风格更符合 Tracero 展示给评委的样子，愿意多花时间学 Tailwind → 选 shadcn 路线

两条路都走得通，不存在哪个"明显更差"。Tracero 需要的三栏布局、视角切换、Chat 面板，两套方案都能实现。

选定之后，下一步就是把 App.tsx 里的视角 state 真正用起来——根据 role 的值过滤显示的内容，这是 Tracero 最有冲击力的演示效果。

---

## 附录：外部资源链接汇总

### 环境安装

| 工具 | 官网 |
|------|------|
| Node.js（下载 LTS 版） | https://nodejs.org |
| Git for Windows | https://git-scm.com/download/win |
| VS Code | https://code.visualstudio.com |

### shadcn 相关

| 资源 | 地址 |
|------|------|
| shadcn-admin 在线 Demo | https://shadcn-admin.netlify.app |
| shadcn-admin GitHub 仓库 | https://github.com/satnaing/shadcn-admin |
| shadcn/ui 组件文档 | https://ui.shadcn.com/docs/components |
| shadcn-chatbot-kit（Chat 组件） | https://github.com/Blazity/shadcn-chatbot-kit |
| TailwindCSS 文档 | https://tailwindcss.com/docs |
| TanStack Router 文档 | https://tanstack.com/router |

### Ant Design 相关

| 资源 | 地址 |
|------|------|
| antd 在线 Demo（第三方） | https://antd-multipurpose-dashboard.netlify.app |
| Ant Design 5 中文文档 | https://ant.design/components/overview-cn |
| @ant-design/x（AI 组件） | https://github.com/ant-design/x |
| Ant Design Pro 模板 | https://github.com/ant-design/ant-design-pro |

### 通用前端资源

| 资源 | 地址 |
|------|------|
| React 官方文档（中文） | https://zh-hans.react.dev |
| Vite 文档 | https://vitejs.dev |
| react-resizable-panels（三栏布局） | https://github.com/bvaughn/react-resizable-panels |
| react-syntax-highlighter（代码高亮） | https://github.com/react-syntax-highlighter/react-syntax-highlighter |
| roslibjs（连接 rosbridge） | https://github.com/RobotWebTools/roslibjs |

### Tracero 项目相关

| 资源 | 地址 |
|------|------|
| Foxglove（机器人数据可视化参考） | https://foxglove.dev |

---

> 文档版本：2026-05
> 如有问题，直接找项目组讨论。
