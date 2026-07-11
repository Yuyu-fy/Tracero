# TurtleBot3 仿真完整指南
## Windows 11 + WSL2 + Docker Desktop 环境搭建与体验

> **适用读者**：完全没有安装过 WSL2 和 Docker Desktop 的 Windows 11 x64 用户  
> **目标环境**：Ubuntu 22.04 + ROS2 Humble + TurtleBot3 Burger + Nav2 + Gazebo Classic gz11  
> **文档版本**：2025年  

---

## 目录

1. [背景介绍](#1-背景介绍)
2. [准备 WSL2](#2-准备-wsl2)
3. [准备 Docker Desktop 与 GUI 显示](#3-准备-docker-desktop-与-gui-显示)
4. [方案A：官方 apt 版快速体验](#4-方案a官方-apt-版快速体验)
5. [方案B：从源码 Build 版本](#5-方案b从源码-build-版本)
6. [完整仿真工作流（A/B 方案共用）](#6-完整仿真工作流ab-方案共用)
7. [下载更多仿真环境](#7-下载更多仿真环境)
8. [常见问题排错和技巧](#8-常见问题排错和技巧)
9. [附件](#9-附件)

---

## 1. 背景介绍

在正式动手之前，先用几段话把你将要用到的每个技术是什么、为什么要用它说清楚。

### 1.1 WSL2 是什么

WSL2（Windows Subsystem for Linux 2）是 Microsoft 内置于 Windows 11 的一个功能，它让你可以在 Windows 上**直接运行一个真正的 Linux 系统**，而不需要双系统或虚拟机软件。

**WSL2 的本质**：它在 Windows 内核里运行了一个轻量的 Hyper-V 虚拟机，里面跑着一个完整的 Linux 内核。对你来说，它就像打开了一个 Linux 终端窗口，但你的 Windows 桌面和文件都还在。

**WSL2 和 WSL1 的区别**：WSL1 是转译层（把 Linux 系统调用翻译成 Windows 调用），兼容性差；WSL2 用真正的 Linux 内核，兼容性接近原生 Linux。我们用 **WSL2**。

**WSLg（WSL GUI）**：Windows 11 内置了 WSLg，它让 Linux 图形界面程序（如 Gazebo、RViz2）可以直接显示在 Windows 桌面上，无需额外安装 X Server 软件（如 VcXsrv）。

### 1.2 Docker 和 Docker Desktop 是什么

**Docker** 是一个容器化平台。你可以把它理解成一种轻量的"打包盒"技术：把软件和它的所有依赖（系统库、配置、环境变量）一起打包成一个叫做 **Image（镜像）** 的文件，然后从这个镜像运行出一个 **Container（容器）**。

**容器 vs 虚拟机**：
- 虚拟机：模拟整台计算机，包括硬件，很重
- 容器：共享宿主机 Linux 内核，只隔离文件系统和进程，启动快、资源占用少

**Docker Desktop** 是 Docker 在 Windows 上的图形化管理工具，它帮你在后台管理 WSL2 里的 Docker 引擎，并提供一个图形界面查看容器和镜像。

**为什么我们用 Docker？**
- ROS2 的安装依赖非常复杂，容易污染系统环境
- Docker 让每个实验环境相互隔离，坏了重建即可
- Dockerfile 记录每一步，可以完整复现
- 我们的 Autoware 课程用的是同样的模式，经验可以复用

### 1.3 Ubuntu 是什么

Ubuntu 是最流行的 Linux 发行版之一，由 Canonical 公司维护。它是 ROS2 官方支持的主要平台。

**LTS 版本**：LTS（Long-Term Support，长期支持版）每两年发布一次，提供 5 年安全更新。我们用 **Ubuntu 22.04 LTS（代号 Jammy Jellyfish）**，这是 ROS2 Humble 的官方支持平台。

**apt**：Ubuntu 的包管理工具，类似 Windows 的应用商店，用命令行安装软件：
```bash
sudo apt install 软件名
```

### 1.4 ROS2 是什么

ROS2（Robot Operating System 2）不是一个操作系统，而是一套**机器人开发框架**，提供：
- **话题（Topic）**：节点间发布/订阅消息的通信机制
- **服务（Service）**：请求/响应式通信
- **动作（Action）**：长时间任务的异步通信
- **节点（Node）**：一个独立运行的程序单元
- **launch 文件**：一次性启动多个节点的配置文件
- **colcon**：ROS2 的编译工具

ROS2 vs ROS1：ROS1 已停止维护，ROS2 是现代版本，支持实时系统、多机器人、安全通信。

**ROS2 Humble Hawksbill**：2022年5月发布的 LTS 版本，支持到2027年，是目前最稳定的长期支持版。

**DDS（Data Distribution Service）**：ROS2 底层的通信中间件，我们默认使用 CycloneDDS。

### 1.5 TurtleBot3 是什么

TurtleBot3 是韩国 ROBOTIS 公司推出的**开源教育/研究机器人平台**，是 ROS2 官方推荐的参考机器人。

**三种型号**：
- **Burger**（汉堡）：最小款，双轮差速驱动，360° LiDAR，Raspberry Pi 4 ✅ 我们用这个
- **Waffle Pi**：较大款，额外有摄像头
- **Waffle**：已停产

**为什么选 Burger？**
- 模型最简单，仿真计算量最小
- 教程资料最多
- 价格最亲民（约5500元人民币），方便后续购买实车

**核心传感器**：360° 2D LiDAR（激光雷达），用于 SLAM 建图和障碍物检测。

### 1.6 Nav2 是什么

Nav2（Navigation2）是 ROS2 的**自主导航栈**，是 ROS1 Navigation Stack 的现代化重写版本。它让机器人能够：

- **SLAM**（Simultaneous Localization and Mapping）：边走边建立环境地图，同时定位自己
- **路径规划**：在已知地图上规划从 A 到 B 的路径（Global Planner）
- **路径跟踪**：实时控制机器人沿规划路径行走，避开动态障碍物（Local Planner）
- **AMCL 定位**：在已知地图上用粒子滤波定位（Adaptive Monte Carlo Localization）

Nav2 的主要组件：
- `nav2_bringup`：启动整个导航栈的 launch 文件集合
- `slam_toolbox`：现代 SLAM 算法，我们用它建图
- `nav2_amcl`：已知地图下的定位
- `nav2_planner`：全局路径规划
- `nav2_controller`：局部路径跟踪控制器

### 1.7 Gazebo 仿真器是什么

Gazebo 是 ROS 生态的**3D 物理仿真器**，让你在没有实体机器人的情况下仿真机器人的传感器、运动和环境交互。

**Gazebo Classic（gz11）**：Gazebo 的老版本，版本号为 Gazebo 11，使用 OpenGL + OGRE1 渲染引擎。2025年正式停止维护，但对于 ROS2 Humble 学习仍是最稳定的选择。

**为什么用 Gazebo Classic 而不是新版 Gazebo？**
- TurtleBot3 的官方仿真包最成熟的版本针对 Gazebo Classic
- Gazebo Classic 使用 OpenGL，在 WSL2+Docker 环境中最兼容（新版用 OGRE2，在 Docker 里有黑屏问题）
- 网上 99% 的 TurtleBot3 + ROS2 Humble 教程基于 Gazebo Classic

---

### 我们的技术组合

```
Windows 11 (x64)
    └── WSL2 (Ubuntu 22.04 LTS)
            └── Docker Desktop
                    └── Docker 容器
                            ├── Ubuntu 22.04 LTS
                            ├── ROS2 Humble Hawksbill
                            ├── TurtleBot3 (Burger 型号)
                            ├── Nav2
                            └── Gazebo Classic gz11
```

**显示路径**：Gazebo/RViz2 图形界面 → WSLg X Server → Windows 11 桌面

---

## 2. 准备 WSL2

### 2.1 前置检查：确认系统要求

在开始前，确认你的 Windows 11 符合要求。

**第一步：确认 Windows 版本**

按 `Win + R`，输入 `winver`，回车：

```
要求：Windows 11，版本 21H2 或更高
```

**第二步：确认 CPU 虚拟化已开启**

打开任务管理器（`Ctrl + Shift + Esc`）→ 性能 → CPU，查看右下角**"虚拟化：已启用"**。

如果显示"已禁用"，需要进入 BIOS 开启 Intel VT-x（Intel CPU）或 AMD-V（AMD CPU）。

### 2.2 安装 WSL2 和 Ubuntu 22.04

**第一步：以管理员身份打开 PowerShell**

在 Windows 开始菜单搜索 `PowerShell`，右键点击 → **"以管理员身份运行"**。

**第二步：更新 WSL 到最新版本**

```powershell
wsl --update
```

等待更新完成。

**第三步：安装 Ubuntu 22.04**

```powershell
wsl --install -d Ubuntu-22.04
```

这条命令会：
1. 启用 WSL2 必要的 Windows 功能
2. 下载并安装 Ubuntu 22.04（需要联网，约几百 MB）
3. 完成后**自动重启 Windows**（请先保存其他工作）

> 💡 **提示**：如果提示需要重启，重启后 Ubuntu 会自动继续安装。

**第四步：设置 Linux 用户名和密码**

重启后，Ubuntu 终端窗口会自动打开，提示你：

```
Enter new UNIX username: （输入你的用户名，比如 student）
New password: （输入密码，输入时不显示，这是正常的）
Retype new password: （再输入一次确认）
```

> ⚠️ **注意**：用户名只能用小写字母、数字和连字符，不能有空格。密码要记住，后面 `sudo` 命令会用到。

**第五步：验证安装成功**

安装完成后，在 Ubuntu 终端里输入：

```bash
# 查看当前发行版信息
cat /etc/os-release

# 应该看到：
# NAME="Ubuntu"
# VERSION="22.04.x LTS (Jammy Jellyfish)"
```

```bash
# 查看 WSL 版本
wsl --list --verbose
```

在 PowerShell 里运行上面的命令，应该看到：

```
  NAME            STATE           VERSION
* Ubuntu-22.04    Running         2
```

VERSION 列显示 **2** 表示是 WSL2，正确。

### 2.3 更新 Ubuntu 系统

打开 Ubuntu 22.04 终端（在开始菜单搜索 "Ubuntu 22.04"），运行：

```bash
# 更新包索引
sudo apt update

# 升级所有已安装的包（会询问 [Y/n]，输入 Y 回车）
sudo apt upgrade -y
```

安装基础工具：

```bash
sudo apt install -y \
    curl wget git \
    vim nano \
    net-tools \
    x11-apps \
    mesa-utils
```

### 2.4 验证 WSLg GUI 显示（非常重要！）

WSLg 是 Windows 11 内置的 Linux GUI 支持，我们需要验证它工作正常，这样后面 Gazebo 才能显示。

**在 Ubuntu 终端里运行：**

```bash
# 检查显示变量是否存在
echo $DISPLAY
# 期望输出：:0  （或者 :0.0）

echo $WAYLAND_DISPLAY  
# 期望输出：wayland-0
```

如果两个变量都有输出，继续下一步：

```bash
# 运行一个简单的图形程序测试
xclock
```

如果一个**模拟时钟窗口**出现在 Windows 桌面上，WSLg 工作正常！按 `Ctrl+C` 关闭它。

```bash
# 测试 OpenGL（Gazebo 需要）
glxgears
```

如果出现一个转动的齿轮动画，OpenGL 也正常。按 `Ctrl+C` 关闭。

> ⚠️ **如果 xclock 没出现**：尝试运行 `wsl --update && wsl --shutdown`，然后重新打开 Ubuntu 终端再试。

### 2.5 重要环境变量说明

在 ROS2 和 TurtleBot3 的使用中，有几个环境变量你会频繁遇到，这里统一解释：

| 环境变量 | 示例值 | 作用 |
|---|---|---|
| `TURTLEBOT3_MODEL` | `burger` | 指定使用哪个 TurtleBot3 型号 |
| `DISPLAY` | `:0` | 告诉 GUI 程序把画面显示到哪里 |
| `ROS_DOMAIN_ID` | `30` | 隔离不同用户/机器的 ROS2 网络，0-232 |
| `GAZEBO_MODEL_PATH` | `/path/to/models` | 告诉 Gazebo 去哪里找3D模型文件 |
| `ROS_DISTRO` | `humble` | 当前 ROS2 发行版名称 |

**环境变量的设置方式：**

```bash
# 临时设置（只在当前终端有效，关闭终端后消失）
export TURTLEBOT3_MODEL=burger

# 永久设置（写入 ~/.bashrc，每次打开新终端自动生效）
echo 'export TURTLEBOT3_MODEL=burger' >> ~/.bashrc
source ~/.bashrc
```

---

## 3. 准备 Docker Desktop 与 GUI 显示

### 3.1 下载并安装 Docker Desktop

**第一步：下载 Docker Desktop**

前往官方网站下载：
```
https://www.docker.com/products/docker-desktop/
```

点击 "Download for Windows - AMD64"（注意是 AMD64/x64 版本）。

**第二步：安装**

双击下载的 `Docker Desktop Installer.exe`，安装时：
- ✅ 勾选 **"Use WSL 2 instead of Hyper-V"**（推荐，使用 WSL2 后端）
- ✅ 勾选 **"Add shortcut to desktop"**（方便）
- 点击 OK，等待安装完成

安装完成后会提示重启，点击"Close and restart"。

**第三步：启动 Docker Desktop**

重启后，Docker Desktop 会自动启动（系统托盘里有一个鲸鱼图标 🐳）。  
首次启动需要接受用户协议，点击 Accept。

等待 Docker Desktop 完全启动（鲸鱼图标变为稳定状态，不再有动画）。

### 3.2 配置 Docker Desktop 与 WSL2 集成

**打开 Docker Desktop 设置**：

点击右上角齿轮图标 ⚙️ → **Resources → WSL Integration**：

- ✅ 开启 **"Enable integration with my default WSL distro"**
- ✅ 在发行版列表中找到 **Ubuntu-22.04**，把开关打开
- 点击 **"Apply & Restart"**

### 3.3 验证 Docker 在 WSL2 中可用

打开 Ubuntu 22.04 终端，运行：

```bash
# 检查 Docker 版本
docker --version
# 期望输出类似：Docker version 26.x.x, build xxxxxxx

# 运行测试容器
docker run hello-world
```

如果看到 "Hello from Docker!" 字样，Docker 在 WSL2 里工作正常。

### 3.4 理解 Docker 核心概念

在继续之前，先理解几个你会反复使用的概念：

**Image（镜像）** = 模板，只读，类似安装包  
**Container（容器）** = 镜像运行起来的实例，类似运行中的程序  
**Dockerfile** = 描述如何构建 Image 的脚本文件  
**Volume（卷）** = 将宿主机目录挂载进容器，实现数据持久化  

**常用 Docker 命令速查**：

```bash
docker images               # 列出本地所有镜像
docker ps                   # 列出正在运行的容器
docker ps -a                # 列出所有容器（包括已停止的）
docker build -t 名字 .      # 从当前目录的 Dockerfile 构建镜像
docker run ...              # 创建并启动容器
docker start 容器名         # 启动已停止的容器
docker stop 容器名          # 停止容器
docker exec -it 容器名 bash # 进入正在运行的容器
docker rm 容器名            # 删除容器
docker rmi 镜像名           # 删除镜像
```

### 3.5 验证 Docker 容器内 GUI 显示（关键步骤）

这一步验证"Docker 容器里的 GUI 程序能否显示到 Windows 桌面"。这是 Gazebo 能够工作的基础。

**在 Ubuntu 22.04 终端里运行：**

```bash
# 第一步：查看当前 DISPLAY 变量
echo $DISPLAY
# 期望输出：:0

# 第二步：运行一个容器，在容器内启动 xeyes（一个跟踪鼠标的眼睛程序）
docker run --rm \
    -e DISPLAY=$DISPLAY \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    ubuntu:22.04 \
    bash -c "apt-get update -q && apt-get install -y -q x11-apps && xeyes"
```

> ⏳ 第一次运行会下载 Ubuntu 22.04 镜像，需要等待几分钟。

如果看到一双眼睛跟踪你的鼠标出现在 Windows 桌面，GUI 显示通路完全正常！

按 `Ctrl+C` 关闭。

**理解这条命令的每个参数**：

```bash
docker run \
    --rm \                              # 容器退出后自动删除（测试用）
    -e DISPLAY=$DISPLAY \              # 把宿主机的 DISPLAY 变量传入容器
    -v /tmp/.X11-unix:/tmp/.X11-unix \ # 挂载 X11 socket，GUI 通过它显示
    ubuntu:22.04 \                     # 使用的镜像
    bash -c "..."                      # 在容器里执行的命令
```

### 3.6 多终端操作说明（重要！）

在 TurtleBot3 仿真中，你**同时需要多个终端**，分别运行：Gazebo、Nav2、RViz2、Teleop 键盘控制等。

**操作模式：一个容器，多个 Shell 进入**

```
Shell 1（主终端）         Shell 2                Shell 3
──────────────────        ──────────────          ──────────────────
docker run ...            docker exec ...         docker exec ...
（创建并进入容器）           （进入同一容器）            （进入同一容器）
↓                         ↓                       ↓
Gazebo 仿真               Nav2 导航               RViz2 / Teleop
```

**具体操作步骤：**

终端1（主终端）— 创建并进入容器：
```bash
# 这是完整的 docker run 命令，后面章节会详细说
docker start -ai turtlebot3_humble
```

终端2（在 Windows 开始菜单再开一个 Ubuntu 22.04 终端）：
```bash
# 先进入 WSL2
# 然后进入已经在运行的容器
docker exec -it turtlebot3_humble bash
```

终端3（同上，再开一个）：
```bash
docker exec -it turtlebot3_humble bash
```

> 💡 **关键理解**：`docker run` = 创建新容器并进入；`docker exec` = 进入**已有的运行中**容器。  
> 仿真时，始终只有一个容器在运行，多个终端通过 `docker exec` 进入**同一个**容器。

---

## 4. 方案A：官方 apt 版快速体验

这是第一个 Docker 环境，目标是**用最快的方式**跑通 TurtleBot3 + Nav2 + Gazebo 的完整仿真，建立直观感受。

所有软件通过 `apt install` 安装官方预编译版本，无需自己编译。

### 4.1 创建工作目录

在 Ubuntu 22.04 终端里：

```bash
mkdir -p ~/workspace/turtlebot3_apt/home
cd ~/workspace/turtlebot3_apt
```

### 4.2 编写 Dockerfile

```bash
cat > Dockerfile << 'EOF'
# 基础镜像：OSRF 官方 ROS2 Humble 完整桌面版
# 已包含：ROS2 Humble + RViz2 + Gazebo Classic gz11
FROM osrf/ros:humble-desktop-full

# 避免 apt 安装过程中的交互提示
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai

# 安装基础工具
RUN apt-get update && apt-get install -y \
    curl wget git vim nano \
    python3-pip \
    python3-colcon-common-extensions \
    python3-rosdep \
    python3-vcstool \
    tmux \
    net-tools \
    iputils-ping \
    x11-apps \
    && rm -rf /var/lib/apt/lists/*

# 安装 Gazebo Classic gz11 的 ROS2 桥接包
# （Gazebo 本体已在 humble-desktop-full 中，这里安装 ROS2 集成包）
RUN apt-get update && apt-get install -y \
    ros-humble-gazebo-* \
    && rm -rf /var/lib/apt/lists/*

# 安装 Cartographer（SLAM 算法）
RUN apt-get update && apt-get install -y \
    ros-humble-cartographer \
    ros-humble-cartographer-ros \
    && rm -rf /var/lib/apt/lists/*

# 安装 Nav2（导航栈）
RUN apt-get update && apt-get install -y \
    ros-humble-navigation2 \
    ros-humble-nav2-bringup \
    && rm -rf /var/lib/apt/lists/*

# 安装 slam-toolbox（另一个常用 SLAM）
RUN apt-get update && apt-get install -y \
    ros-humble-slam-toolbox \
    && rm -rf /var/lib/apt/lists/*

# 安装 TurtleBot3 相关包
RUN apt-get update && apt-get install -y \
    ros-humble-dynamixel-sdk \
    ros-humble-turtlebot3-msgs \
    ros-humble-turtlebot3 \
    ros-humble-turtlebot3-simulations \
    && rm -rf /var/lib/apt/lists/*

# 初始化 rosdep
RUN rosdep init || true && rosdep update

# 设置 ROS2 环境自动 source
RUN echo "source /opt/ros/humble/setup.bash" >> /root/.bashrc

# 设置 TurtleBot3 型号（Burger）
RUN echo "export TURTLEBOT3_MODEL=burger" >> /root/.bashrc

# 设置 Gazebo 模型路径（必须，否则 TurtleBot3 模型找不到）
RUN echo "export GAZEBO_MODEL_PATH=\$GAZEBO_MODEL_PATH:/opt/ros/humble/share/turtlebot3_gazebo/models" >> /root/.bashrc

# 设置 ROS_DOMAIN_ID（30是TurtleBot3官方推荐的默认值）
RUN echo "export ROS_DOMAIN_ID=30" >> /root/.bashrc

# 也 source Gazebo 环境
RUN echo "source /usr/share/gazebo/setup.sh" >> /root/.bashrc

# 设置工作目录
RUN mkdir -p /root/workspace
WORKDIR /root/workspace

CMD ["/bin/bash"]
EOF
```

### 4.3 构建 Docker 镜像

```bash
# 构建镜像，名称为 turtlebot3-humble-apt
# 这一步需要下载约 3-5 GB 内容，时间较长（10-30 分钟，取决于网速）
docker build -t turtlebot3-humble-apt .
```

> ⏳ 构建过程中你会看到很多输出，这是正常的。  
> 如果某一步失败，检查网络连接后用同一命令重新运行（Docker 有缓存，不会从头开始）。

构建完成后验证：
```bash
docker images | grep turtlebot3-humble-apt
# 应该看到刚才构建的镜像
```

### 4.4 首次创建并启动容器（持久化配置）

> ⚠️ **关于持久化**：`docker run` 创建的容器，停止后数据默认会丢失。  
> 解决方案：我们**不使用 `--rm` 参数**，容器停止后依然存在；同时把工作目录**挂载到宿主机**，代码文件永久保存。

```bash
# 首次运行：创建容器并进入（只需运行一次）
docker run -it \
    --name turtlebot3_apt \
    -e DISPLAY=$DISPLAY \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    -v ~/workspace/turtlebot3_apt/home:/root/workspace \
    -e ROS_DOMAIN_ID=30 \
    --network host \
    turtlebot3-humble-apt

# 参数说明：
# --name turtlebot3_apt         给容器命名，方便后续操作
# -e DISPLAY=$DISPLAY           传入显示变量，GUI 程序用
# -v /tmp/.X11-unix:...         挂载 X11 socket，GUI 显示通路
# -v ~/workspace/...:...        挂载工作目录，文件持久化
# -e ROS_DOMAIN_ID=30           设置 ROS2 通信域 ID
# --network host                共享宿主机网络，ROS2 节点通信用
```

进入容器后，命令提示符会变成类似：
```
root@主机名:/root/workspace#
```

这说明你已经在容器内部了。

### 4.5 容器内验证安装

**在容器内运行以下验证命令：**

```bash
# 确认 ROS2 环境
source /opt/ros/humble/setup.bash
ros2 --version
# 期望：ros2cli 0.18.x

# 确认 TurtleBot3 包已安装
ros2 pkg list | grep turtlebot3
# 期望看到多个 turtlebot3_xxx 包

# 确认 Gazebo 已安装
gazebo --version
# 期望：Gazebo multi-robot simulator, version 11.x.x

# 确认环境变量
echo $TURTLEBOT3_MODEL
# 期望：burger

echo $DISPLAY
# 期望：:0
```

**测试 GUI 显示（在容器内）**：
```bash
xclock &
# 时钟窗口应该出现在 Windows 桌面
# 运行成功后按 Ctrl+C 关闭
```

### 4.6 日常启动容器的方法

以后每次使用，不要再用 `docker run`（那会创建新容器）。用以下命令：

**在 Ubuntu 22.04 终端里：**

```bash
# 启动已停止的容器并进入（Shell 1 主终端）
docker start -ai turtlebot3_apt
```

**开第二个终端时（新开一个 Ubuntu 22.04 窗口）：**

```bash
# 进入已经在运行的容器
docker exec -it turtlebot3_apt bash
```

**停止容器：**
```bash
# 在容器内输入 exit，或在外部：
docker stop turtlebot3_apt
```

> ✅ **持久化确认**：你在 `/root/workspace/` 目录下的所有文件，会保存到宿主机的 `~/workspace/turtlebot3_apt/home/` 目录，容器重建后仍然存在。  
> 容器本身（安装的软件配置）在 `docker stop` 后也会保留，`docker start` 可以恢复。

---

## 5. 方案B：从源码 Build 版本

这是第二个 Docker 环境，在方案A基础上更进一步：**TurtleBot3 和 Nav2 从 GitHub 源码编译**。

> 📌 **前提**：请先确认方案A能跑通完整仿真流程（第6章）。方案A是你的"基准线"——如果A能跑，说明环境正常；B出问题就是编译问题。

> 📌 **Gazebo 不从源码编译**：Gazebo Classic 的依赖极其复杂，从源码编译耗时很长且容易失败。我们用 apt 安装 Gazebo，只对 TurtleBot3 和 Nav2 进行源码 build。

### 5.1 创建新的工作目录

```bash
# 注意：这是一个全新的目录，与方案A完全独立
mkdir -p ~/workspace/turtlebot3_src/home
cd ~/workspace/turtlebot3_src
```

### 5.2 编写 Dockerfile（第一阶段：基础环境）

源码 build 的 Dockerfile 分为两个阶段：  
- **Dockerfile 阶段1**：安装 ROS2 Humble + Gazebo + 编译工具链（不含 TB3 和 Nav2）  
- **容器内操作**：进入容器后手动 clone 源码并 build

这样做的好处：Dockerfile 构建慢但只做一次，源码 build 过程你能看到每一步的输出。

```bash
cat > Dockerfile << 'EOF'
# 基础镜像：OSRF 官方 ROS2 Humble 完整桌面版
FROM osrf/ros:humble-desktop-full

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Shanghai

# 安装基础工具和编译工具链
RUN apt-get update && apt-get install -y \
    curl wget git vim nano \
    python3-pip \
    python3-colcon-common-extensions \
    python3-rosdep \
    python3-vcstool \
    python3-argcomplete \
    tmux \
    net-tools \
    iputils-ping \
    x11-apps \
    build-essential cmake \
    && rm -rf /var/lib/apt/lists/*

# 安装 Gazebo Classic gz11 和 ROS2 桥接包（不从源码编译 Gazebo）
RUN apt-get update && apt-get install -y \
    gazebo \
    ros-humble-gazebo-ros-pkgs \
    ros-humble-gazebo-ros \
    ros-humble-gazebo-plugins \
    ros-humble-gazebo-msgs \
    && rm -rf /var/lib/apt/lists/*

# 安装 Nav2 和 TurtleBot3 的系统级依赖（不是 Nav2/TB3 本身，是它们需要的库）
RUN apt-get update && apt-get install -y \
    ros-humble-angles \
    ros-humble-bondcpp \
    ros-humble-behaviortree-cpp-v3 \
    ros-humble-ompl \
    ros-humble-tf2-sensor-msgs \
    ros-humble-tf2-geometry-msgs \
    ros-humble-pcl-ros \
    libompl-dev \
    && rm -rf /var/lib/apt/lists/*

# 安装 slam-toolbox（作为 SLAM 后端，配合 Nav2 使用）
RUN apt-get update && apt-get install -y \
    ros-humble-slam-toolbox \
    && rm -rf /var/lib/apt/lists/*

# 初始化 rosdep
RUN rosdep init || true && rosdep update

# 设置 ROS2 基础环境
RUN echo "source /opt/ros/humble/setup.bash" >> /root/.bashrc
RUN echo "export TURTLEBOT3_MODEL=burger" >> /root/.bashrc
RUN echo "export ROS_DOMAIN_ID=30" >> /root/.bashrc
RUN echo "source /usr/share/gazebo/setup.sh" >> /root/.bashrc

# 创建源码工作空间目录
RUN mkdir -p /root/turtlebot3_ws/src
RUN mkdir -p /root/nav2_ws/src

WORKDIR /root

CMD ["/bin/bash"]
EOF
```

### 5.3 构建基础镜像

```bash
docker build -t turtlebot3-humble-src-base .
```

> ⏳ 同样需要一段时间，约 10-20 分钟。

### 5.4 首次创建容器

```bash
docker run -it \
    --name turtlebot3_src \
    -e DISPLAY=$DISPLAY \
    -v /tmp/.X11-unix:/tmp/.X11-unix \
    -v ~/workspace/turtlebot3_src/home:/root/workspace \
    -e ROS_DOMAIN_ID=30 \
    --network host \
    turtlebot3-humble-src-base
```

现在你在容器内了，下面的操作全部在容器内进行。

### 5.5 （容器内）获取 TurtleBot3 源码

> **版本说明**：本文档验证时间为 2026年5月，锁定各仓库版本如下表。
> 如需确认版本仍然有效，可在 clone 后执行 `git log --oneline -1` 核对 commit。

#### 版本锁定依据

文档中对四个仓库采用了不同的锁定策略，原因如下：

| 仓库 | 锁定方式 | 锁定到 | 原因 |
|---|---|---|---|
| `turtlebot3` | `git checkout tag` | `2.3.4` | tag 打在 humble 分支上，是 ROBOTIS 官方测试过的稳定点 |
| `turtlebot3_msgs` | `git checkout tag` | `2.4.0` | tag 打在 humble 分支上，本地验证 HEAD 仅比 tag 多一个来自 main 的 merge commit |
| `turtlebot3_simulations` | `git checkout tag` | `2.3.8` | tag 打在 humble 分支上，标注 "humble only"，是仿真包的稳定点 |
| `DynamixelSDK` | 保持 humble 分支 HEAD | humble HEAD | `4.0.5` 这个 tag 打在 main 分支上而非 humble 分支；humble HEAD 比 4.0.5 仅多一个 Python porthandler bug fix 的 merge commit，对仿真无破坏性影响，强行 checkout tag 反而会离开 humble 的 ROS2 兼容 patch |

**为什么要锁版本**：四个仓库各自独立发版，如果不锁，不同时间 clone 的同学可能拿到不同的代码组合，导致 `colcon build` 报错或行为不一致，排查时无法对齐。锁定后所有同学从相同起点出发。

---

#### 获取源码步骤

```bash
# source ROS2 环境
source /opt/ros/humble/setup.bash

# 进入工作空间的 src 目录
cd ~/turtlebot3_ws/src
```

**克隆并锁定 DynamixelSDK（舵机通信库，TurtleBot3 电机驱动依赖）**

```bash
git clone -b humble https://github.com/ROBOTIS-GIT/DynamixelSDK.git

# DynamixelSDK 的 4.0.5 tag 在 main 分支而非 humble 分支，
# 不做 checkout，直接使用 humble HEAD
# （humble HEAD 仅比 4.0.5 多一个 Python porthandler bug fix）
cd DynamixelSDK
git log --oneline -1  # 记录当前 commit，备查
cd ..
```

**克隆并锁定 turtlebot3_msgs（消息定义）**

```bash
git clone -b humble https://github.com/ROBOTIS-GIT/turtlebot3_msgs.git
cd turtlebot3_msgs
git checkout 2.4.0
git log --oneline -1
# 期望输出：bf28eae Merge pull request #53 ...
cd ..
```

**克隆并锁定 turtlebot3（核心包：URDF、launch文件、驱动、teleop等）**

```bash
git clone -b humble https://github.com/ROBOTIS-GIT/turtlebot3.git
cd turtlebot3
git checkout 2.3.4
git log --oneline -1
# 期望输出：ed3521a ...
cd ..
```

**克隆并锁定 turtlebot3_simulations（仿真包：Gazebo world、模型、launch文件）**

```bash
git clone -b humble https://github.com/ROBOTIS-GIT/turtlebot3_simulations.git
cd turtlebot3_simulations
git checkout 2.3.8
git log --oneline -1
# 期望输出：a35a56c ...
cd ..
```

**验证克隆结果**

```bash
ls ~/turtlebot3_ws/src/
# 应该看到 4 个目录：
# DynamixelSDK  turtlebot3  turtlebot3_msgs  turtlebot3_simulations

# 确认各仓库版本
echo "=== DynamixelSDK ===" && git -C DynamixelSDK log --oneline -1
echo "=== turtlebot3_msgs ===" && git -C turtlebot3_msgs describe --tags
echo "=== turtlebot3 ===" && git -C turtlebot3 describe --tags
echo "=== turtlebot3_simulations ===" && git -C turtlebot3_simulations describe --tags

# 期望输出：
# === DynamixelSDK ===
# 0d3403d ...（humble HEAD）
# === turtlebot3_msgs ===
# 2.4.0
# === turtlebot3 ===
# 2.3.4
# === turtlebot3_simulations ===
# 2.3.8
```

> 💡 `git describe --tags` 会输出最近的 tag 名称。如果输出类似 `2.3.4-3-gabcdef`，
> 表示当前 commit 在 tag `2.3.4` 之后还有 3 个 commit，说明 checkout 没有生效，
> 需要重新执行对应的 `git checkout` 命令。


### 5.6 （容器内）安装 TurtleBot3 编译依赖

```bash
# 回到工作空间根目录
cd ~/turtlebot3_ws

# rosdep 自动分析所有包的依赖并安装
rosdep install \
    --from-paths src \
    --ignore-src \
    --rosdistro humble \
    -y

# 参数说明：
# --from-paths src    从 src 目录扫描所有包
# --ignore-src        忽略 src 里已有源码的包（避免重复安装）
# --rosdistro humble  指定 ROS2 发行版
# -y                  自动回答 yes
```

### 5.7 （容器内）编译 TurtleBot3

```bash
# 在工作空间根目录编译
cd ~/turtlebot3_ws

colcon build --symlink-install

# 参数说明：
# --symlink-install  使用符号链接而不是复制文件，
#                    修改 Python 脚本后无需重新编译

# ⏳ 编译 TurtleBot3 大约需要 3-10 分钟
# 你会看到类似：
# Starting >>> DynamixelSDK
# Finished <<< DynamixelSDK [2.3s]
# ...
# Summary: 20 packages finished [8min 30s]
```

如果看到 "Summary: XX packages finished"，编译成功。

```bash
# source TurtleBot3 工作空间
source ~/turtlebot3_ws/install/setup.bash

# 把这行加入 .bashrc，以后进容器自动生效
echo "source ~/turtlebot3_ws/install/setup.bash" >> ~/.bashrc

# 设置 Gazebo 模型路径（让 Gazebo 能找到 TurtleBot3 模型）
echo "export GAZEBO_MODEL_PATH=\$GAZEBO_MODEL_PATH:~/turtlebot3_ws/install/turtlebot3_gazebo/share/turtlebot3_gazebo/models" >> ~/.bashrc

source ~/.bashrc
```

### 5.8 （容器内）验证 TurtleBot3 源码编译结果

```bash
# 查看编译出来的包
ros2 pkg list | grep turtlebot3

# 应该看到：
# turtlebot3_bringup
# turtlebot3_cartographer
# turtlebot3_description
# turtlebot3_example
# turtlebot3_fake_node
# turtlebot3_gazebo
# turtlebot3_msgs
# turtlebot3_navigation2
# turtlebot3_node
# turtlebot3_simulations
# turtlebot3_teleop

echo "✅ TurtleBot3 源码编译完成！"
```

### 5.9 （容器内）获取并编译 Nav2 源码

```bash
# source 所有已有环境
source /opt/ros/humble/setup.bash
source ~/turtlebot3_ws/install/setup.bash

# 进入 Nav2 工作空间
cd ~/nav2_ws/src

# 克隆 Nav2 源码（humble 分支）
git clone https://github.com/ros-navigation/navigation2.git \
    --branch humble \
    ./navigation2

# 回到工作空间根目录
cd ~/nav2_ws

# 安装 Nav2 的编译依赖
rosdep install \
    --from-paths src \
    --ignore-src \
    --rosdistro humble \
    -y

echo "✅ Nav2 依赖安装完成，开始编译..."
```

### 5.10 （容器内）编译 Nav2

> ⚠️ **重要提示**：Nav2 包含大量代码，编译时间较长（20-60 分钟），内存占用也较大。  
> 如果你的 WSL2 内存不足（< 8GB 可用），请加 `--parallel-workers 2` 限制并行数。

```bash
cd ~/nav2_ws

# 正常编译（内存 >= 8GB 推荐）
colcon build --symlink-install

# 如果内存不足或编译被 kill，改用：
# colcon build --symlink-install --parallel-workers 2
```

编译完成后：

```bash
# source Nav2 工作空间
source ~/nav2_ws/install/setup.bash

# 加入 .bashrc
echo "source ~/nav2_ws/install/setup.bash" >> ~/.bashrc
source ~/.bashrc

echo "✅ Nav2 源码编译完成！"
```

### 5.11 验证 Nav2 源码编译结果

```bash
ros2 pkg list | grep nav2 | head -20

# 应该看到很多 nav2_xxx 包：
# nav2_amcl
# nav2_behavior_tree
# nav2_bringup
# nav2_bt_navigator
# nav2_controller
# nav2_costmap_2d
# nav2_lifecycle_manager
# nav2_map_server
# nav2_msgs
# nav2_planner
# ...
```

### 5.12 保存容器状态（重要！）

为了让这些编译好的环境在下次启动时还在，退出容器时**不要**用 `docker rm`：

```bash
# 容器内执行 exit 退出
exit
```

下次启动：
```bash
# 重新进入容器（编译好的东西都还在）
docker start -ai turtlebot3_src
```

### 5.13 方案A与方案B的对比验证

在方案B里运行 TurtleBot3 仿真的命令与方案A完全相同，但你能感受到差异：

| 对比项 | 方案A（apt版） | 方案B（src版） |
|---|---|---|
| 安装方式 | 预编译二进制包 | GitHub源码编译 |
| 安装时间 | 快（apt下载） | 慢（编译需要时间） |
| 可修改性 | 不能修改源码 | 可以修改任何源码 |
| 调试能力 | 有限 | 完整（可加断点、日志） |
| 版本控制 | apt决定 | git分支/commit决定 |
| 适合场景 | 快速体验、教学 | 研究开发、深度学习 |

---

## 6. 完整仿真工作流（A/B 方案共用）

> 📌 本章的所有命令在方案A（`turtlebot3_apt`容器）和方案B（`turtlebot3_src`容器）中均适用。  
> 以下步骤假设你已经进入对应容器。

**整体流程概览：**

```
Step 1: 启动 Gazebo + 生成 TurtleBot3 Burger
    ↓
Step 2: 键盘 Teleop 遥控小车（熟悉控制）
    ↓
Step 3: 启动 SLAM 建图（边遥控边建图）
    ↓
Step 4: 保存地图
    ↓
Step 5: 启动 Nav2 自主导航
    ↓
Step 6: 在 RViz2 中设定目标点，观察自主导航
```

### 6.1 准备：环境确认

在进入容器后，每个终端都需要确认环境：

```bash
# 检查基本环境变量
echo "ROS_DISTRO: $ROS_DISTRO"
echo "TURTLEBOT3_MODEL: $TURTLEBOT3_MODEL"
echo "ROS_DOMAIN_ID: $ROS_DOMAIN_ID"
echo "DISPLAY: $DISPLAY"

# 期望输出：
# ROS_DISTRO: humble
# TURTLEBOT3_MODEL: burger
# ROS_DOMAIN_ID: 30
# DISPLAY: :0
```

如果 `TURTLEBOT3_MODEL` 是空的，手动设置：
```bash
export TURTLEBOT3_MODEL=burger
```

### 6.2 Step 1：启动 Gazebo + 生成 TurtleBot3

**打开终端1，进入容器后执行：**

```bash
# 启动 TurtleBot3 World（经典六角形障碍赛道）
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
```

> ⏳ 第一次启动 Gazebo 需要 30-90 秒加载模型，请耐心等待。

你应该看到：
- 一个 **Gazebo 仿真窗口**出现在桌面（带有六角形障碍物的环境）
- 窗口中有一个小型的 TurtleBot3 Burger 机器人（圆柱形）
- 终端里持续输出 Gazebo 的日志

**其他可用的 World（环境）：**

```bash
# 空旷世界（适合初始验证）
ros2 launch turtlebot3_gazebo empty_world.launch.py

# TurtleBot3 House（室内家居，首次使用需下载模型，约几分钟）
ros2 launch turtlebot3_gazebo turtlebot3_house.launch.py
```

### 6.3 Step 2：键盘遥控小车

**打开终端2（进入同一容器）：**

```bash
docker exec -it turtlebot3_apt bash
# （方案B用：docker exec -it turtlebot3_src bash）
```

**运行键盘遥控节点：**

```bash
ros2 run turtlebot3_teleop teleop_keyboard
```

终端会显示控制说明：

```
Control Your TurtleBot3!
---------------------------
Moving around:
        w
   a    s    d
        x

w/x : increase/decrease linear velocity
a/d : increase/decrease angular velocity
space key, s : force stop

CTRL-C to quit
```

**操作方法：**
- `w`：前进
- `s`：停止
- `x`：后退
- `a`：左转
- `d`：右转
- `空格`：紧急停止

> 💡 **注意**：运行 teleop 的终端窗口必须是**焦点窗口**（点击一下），键盘输入才会被捕获。

在 Gazebo 窗口中，你应该能看到机器人随你的按键移动。

### 6.4 Step 3：SLAM 建图

SLAM 让机器人一边移动，一边用激光雷达扫描环境建立地图。

**保持终端1（Gazebo）和终端2（teleop）运行！**

**打开终端3：**

```bash
docker exec -it turtlebot3_apt bash
```

**启动 Cartographer SLAM：**

```bash
ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True
```

这会打开一个 **RViz2 窗口**，其中显示：
- 灰色区域：未探索区域
- 白色区域：已知的自由空间
- 黑色区域：墙壁/障碍物
- 绿色激光线：实时 LiDAR 扫描数据
- 蓝白色矩形：机器人位置

**现在切换到终端2（teleop），慢慢遥控机器人在 Gazebo 环境中移动：**
- 慢速前进，让 LiDAR 扫描更多区域
- 转圈探索所有区域
- 目标：让 RViz2 地图中的白色区域尽量覆盖整个环境

> 💡 **技巧**：移动时要慢，太快会导致地图漂移。速度设在 0.2-0.3 m/s 即可。

### 6.5 Step 4：保存地图

当你觉得地图建得差不多了（RViz2 中大部分环境已被探索），保存地图。

**打开终端4：**

```bash
docker exec -it turtlebot3_apt bash
```

**保存地图：**

```bash
# 创建保存目录
mkdir -p ~/workspace/maps

# 保存地图（地图名叫 turtlebot3_map）
ros2 run nav2_map_server map_saver_cli \
    -f ~/workspace/maps/turtlebot3_map \
    --ros-args -p save_map_timeout:=5.0
```

这会生成两个文件：
- `turtlebot3_map.pgm`：灰度图像，地图的实际内容（黑=墙，白=空地，灰=未知）
- `turtlebot3_map.yaml`：地图的元数据（分辨率、原点坐标等）

```bash
# 查看保存的地图文件
ls -la ~/workspace/maps/
```

**保存完成后，关闭 Cartographer（在终端3按 Ctrl+C）**。

### 6.6 Step 5：启动 Nav2 自主导航

有了地图，现在启动 Nav2 导航栈，让机器人能够自主规划路径。

> ⚠️ **关闭终端2的 teleop**（按 Ctrl+C），Nav2 和 teleop 不能同时控制机器人。

**在终端3（刚才关闭了 Cartographer 的终端）：**

```bash
# 启动 Nav2 导航栈
ros2 launch turtlebot3_navigation2 navigation2.launch.py \
    use_sim_time:=True \
    map:=~/workspace/maps/turtlebot3_map.yaml
```

这会启动一系列导航节点，并打开 RViz2 窗口。

Nav2 启动的主要节点包括：
- `amcl`：粒子滤波定位，在地图上估计机器人位置
- `nav2_planner`：全局路径规划（A* 算法）
- `nav2_controller`：局部路径跟踪控制器
- `nav2_costmap_2d`：代价地图（标记障碍物周围的危险区域）
- `lifecycle_manager`：管理所有导航节点的生命周期

### 6.7 Step 6：在 RViz2 中设定目标点

Nav2 启动后，RViz2 窗口里会显示已保存的地图，但机器人位置可能不准确（显示在地图中间）。

**第一步：设置初始位姿（Initial Pose）**

机器人需要知道自己在地图上的起始位置（AMCL 定位的起点）：

1. 在 RViz2 工具栏找到 **"2D Pose Estimate"** 按钮（或按 `P`）
2. 在地图上机器人**实际所在位置**点击并拖拽，设置朝向
3. 你会看到绿色箭头出现，表示估计的初始位姿
4. 稍等片刻，AMCL 会调整粒子云，绿色点云集中说明定位成功

> 💡 **如何判断实际位置？**：观察 Gazebo 窗口中机器人的位置，在 RViz2 地图上找对应位置。

**第二步：设置导航目标点（Nav Goal）**

1. 在 RViz2 工具栏找到 **"Nav2 Goal"** 按钮（或按 `G`）
2. 在地图上**目标位置**点击并拖拽，设置机器人到达时的朝向
3. 松开鼠标，Nav2 开始计算路径

**第三步：观察自主导航**

切换到 Gazebo 窗口，你会看到：
- 机器人开始自动向目标点移动
- RViz2 中显示：全局规划路径（绿色线）、局部规划路径（红色线）
- 机器人会绕过障碍物、沿规划路径行进
- 到达目标后停止

🎉 **恭喜！你已经完成了一次完整的 TurtleBot3 仿真循环！**

### 6.8 查看 ROS2 话题（进阶理解）

在任意终端，你可以实时观察 ROS2 的通信：

```bash
# 查看所有活跃话题
ros2 topic list

# 主要话题说明：
# /scan              LiDAR 扫描数据
# /odom              里程计（机器人位移信息）
# /cmd_vel           速度指令（控制机器人移动）
# /map               SLAM 生成的地图
# /tf                坐标系变换树
# /amcl_pose         AMCL 估计的机器人位置

# 实时查看 LiDAR 数据
ros2 topic echo /scan --once

# 实时查看机器人速度指令
ros2 topic echo /cmd_vel

# 查看话题的发布频率
ros2 topic hz /scan
```

```bash
# 查看所有节点
ros2 node list

# 查看 TF 树（坐标系关系）
ros2 run tf2_tools view_frames
```

---

## 7. 下载更多仿真环境

ROBOTIS 官方提供了 3 个仿真环境，社区提供了更多高质量的 Gazebo World。

### 7.1 官方内置 World（已包含在安装中）

```bash
# World 1：空旷世界（最轻量）
ros2 launch turtlebot3_gazebo empty_world.launch.py

# World 2：TurtleBot3 经典赛道（六角形障碍）
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py

# World 3：室内家居（多房间，首次启动需下载模型）
ros2 launch turtlebot3_gazebo turtlebot3_house.launch.py
```

### 7.2 AWS RoboMaker 开源场景（推荐！）

Amazon AWS 开源了一批高质量的 Gazebo 场景，MIT 协议免费使用。

**在容器内安装：**

```bash
cd ~/workspace

# 克隆 AWS 场景仓库
git clone https://github.com/aws-robotics/aws-robomaker-small-house-world.git
git clone https://github.com/aws-robotics/aws-robomaker-hospital-world.git
git clone https://github.com/aws-robotics/aws-robomaker-small-warehouse-world.git
git clone https://github.com/aws-robotics/aws-robomaker-bookstore-world.git
```

**小型住宅场景（最推荐入门）：**
```bash
cd ~/workspace/aws-robomaker-small-house-world
chmod +x setup.sh && ./setup.sh

export GAZEBO_MODEL_PATH=$GAZEBO_MODEL_PATH:$(pwd)/models
gazebo worlds/small_house.world
```

**医院场景：**
```bash
cd ~/workspace/aws-robomaker-hospital-world
chmod +x setup.sh && ./setup.sh

export GAZEBO_MODEL_PATH=$GAZEBO_MODEL_PATH:$(pwd)/models:$(pwd)/fuel_models
gazebo worlds/hospital.world
```

**仓库场景：**
```bash
cd ~/workspace/aws-robomaker-small-warehouse-world
chmod +x setup.sh && ./setup.sh

export GAZEBO_MODEL_PATH=$GAZEBO_MODEL_PATH:$(pwd)/models
gazebo worlds/small_warehouse.world
```

**在新 World 中运行 TurtleBot3：**

下载好 World 后，可以把 TurtleBot3 spawn 到任意 World 中：

```bash
# 启动 Gazebo 并加载自定义 World（以小型住宅为例）
export GAZEBO_MODEL_PATH=$GAZEBO_MODEL_PATH:~/workspace/aws-robomaker-small-house-world/models

ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py \
    world:=~/workspace/aws-robomaker-small-house-world/worlds/small_house.world
```

### 7.3 场景难度推进建议

| 场景 | 特点 | 建议练习内容 |
|---|---|---|
| `empty_world` | 无障碍，空旷 | 验证环境，学习话题 |
| `turtlebot3_world` | 小型封闭赛道 | SLAM 建图、Nav2 基础 |
| `small_house` | 室内多房间 | Nav2 waypoint 导航 |
| `bookstore` | 书店窄道 | 障碍物避让调参 |
| `hospital` | 大型复杂室内 | 长距离路径规划 |
| `small_warehouse` | 工业货架环境 | 工业场景导航 |

---

## 8. 常见问题排错和技巧

### 8.1 Gazebo 启动但窗口全黑

**症状**：Gazebo 窗口打开了，但 3D 渲染区域是黑色的，看不到任何模型。

**原因**：渲染引擎（OGRE）初始化失败，通常是软件渲染的 OpenGL 版本问题。

**解决方案：**

```bash
# 方案1：强制使用软件渲染（降级方案，能跑但较慢）
export LIBGL_ALWAYS_SOFTWARE=1
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py

# 方案2：检查 DISPLAY 变量
echo $DISPLAY
# 如果为空，运行：
export DISPLAY=:0

# 方案3：重启 WSL2
# 在 PowerShell 里：
# wsl --shutdown
# 然后重新开启 Ubuntu 终端
```

### 8.2 Gazebo 模型找不到（显示红色框或缺少模型）

**症状**：Gazebo 启动，但机器人显示为红色框，或 TurtleBot3 World 的障碍物不显示。

**原因**：`GAZEBO_MODEL_PATH` 没有包含 TurtleBot3 模型的路径。

**解决方案：**

```bash
# 查看当前 GAZEBO_MODEL_PATH
echo $GAZEBO_MODEL_PATH

# 手动添加（apt 版）
export GAZEBO_MODEL_PATH=$GAZEBO_MODEL_PATH:/opt/ros/humble/share/turtlebot3_gazebo/models

# 手动添加（src 版）
export GAZEBO_MODEL_PATH=$GAZEBO_MODEL_PATH:~/turtlebot3_ws/install/turtlebot3_gazebo/share/turtlebot3_gazebo/models

# 验证路径是否存在
ls /opt/ros/humble/share/turtlebot3_gazebo/models/
```

### 8.3 ROS2 节点看不到彼此

**症状**：`ros2 topic list` 看不到期望的话题，或多个节点无法通信。

**原因**：`ROS_DOMAIN_ID` 不一致。

**解决方案：**

```bash
# 确认所有终端（容器里）的 ROS_DOMAIN_ID 一致
echo $ROS_DOMAIN_ID

# 如果不一致，统一设置为同一个值
export ROS_DOMAIN_ID=30

# 或者在 docker run 时加 -e ROS_DOMAIN_ID=30
```

### 8.4 colcon build 被 kill（内存不足）

**症状**：编译过程中突然停止，进程被 killed，没有完整的错误信息。

**原因**：WSL2 默认内存限制，编译 Nav2 等大项目时内存不足。

**解决方案：**

**方案1：限制并行编译数量：**
```bash
colcon build --symlink-install --parallel-workers 2
```

**方案2：增加 WSL2 内存限制：**

在 Windows 用户目录（`C:\Users\你的用户名\`）创建或编辑 `.wslconfig` 文件：

```
# C:\Users\你的用户名\.wslconfig
[wsl2]
memory=8GB
swap=4GB
processors=4
```

保存后在 PowerShell 运行：
```powershell
wsl --shutdown
```

重新启动 WSL2 后内存限制生效。

### 8.5 xclock/xeyes 运行但没有窗口出现

**症状**：运行图形程序没有报错，但 Windows 桌面没有窗口出现。

**原因**：WSLg 与 DISPLAY 变量配置问题。

**解决方案：**

```bash
# 检查 WSLg 相关变量
ls /tmp/.X11-unix/     # 应该有 X0 文件
echo $DISPLAY          # 应该是 :0

# 如果 DISPLAY 为空，手动设置
export DISPLAY=:0

# 查找 X11 socket
ls -la /tmp/.X11-unix/

# 更新 WSL
# 在 PowerShell 里：wsl --update && wsl --shutdown
```

### 8.6 Nav2 启动后机器人不动

**症状**：设置了 Nav2 Goal，但机器人没有移动。

**原因1**：Initial Pose 没有设置或设置不准确。  
**原因2**：Nav2 节点没有完全启动。

**解决方案：**

```bash
# 检查 Nav2 节点是否全部运行
ros2 node list | grep nav2

# 确认 amcl 话题在发布
ros2 topic echo /amcl_pose --once

# 在 RViz2 中重新设置 2D Pose Estimate（更准确的初始位置）
# Nav2 需要准确的初始位姿才能开始定位和规划
```

### 8.7 容器退出后安装的软件消失

**症状**：在容器内用 apt install 安装了软件，重启容器后不见了。

**原因**：你用了 `--rm` 参数，或者删除了容器重新运行了 `docker run`。

**解决方案：**

```bash
# 确认容器存在（即使停止状态）
docker ps -a | grep turtlebot3

# 正确的日常启动方式（不是 docker run）
docker start -ai turtlebot3_apt

# 如果容器被误删，需要重新 docker run 并重新安装配置
# 所以：平时只用 docker start，不要 docker run
```

### 8.8 Windows 11 WSL2 + Docker，Host 侧访问容器源码
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

---

## 9. 附件

### 9.1 官方文档链接

| 文档 | 链接 |
|---|---|
| TurtleBot3 官方手册 | https://emanual.robotis.com/docs/en/platform/turtlebot3/ |
| ROS2 Humble 文档 | https://docs.ros.org/en/humble/ |
| Nav2 官方文档 | https://docs.nav2.org/ |
| Gazebo Classic 文档 | https://classic.gazebosim.org/ |
| Docker 文档 | https://docs.docker.com/ |
| WSL2 官方文档 | https://learn.microsoft.com/zh-cn/windows/wsl/ |

### 9.2 核心 GitHub 仓库

**ROBOTIS 官方仓库：**

| 仓库 | 说明 |
|---|---|
| [ROBOTIS-GIT/turtlebot3](https://github.com/ROBOTIS-GIT/turtlebot3) | TurtleBot3 核心包（URDF、bringup、teleop） |
| [ROBOTIS-GIT/turtlebot3_simulations](https://github.com/ROBOTIS-GIT/turtlebot3_simulations) | Gazebo 仿真包（World、模型、launch文件） |
| [ROBOTIS-GIT/turtlebot3_msgs](https://github.com/ROBOTIS-GIT/turtlebot3_msgs) | 自定义消息定义 |
| [ROBOTIS-GIT/DynamixelSDK](https://github.com/ROBOTIS-GIT/DynamixelSDK) | 舵机通信库（TurtleBot3 的底层依赖） |
| [ROBOTIS-GIT/turtlebot3_machine_learning](https://github.com/ROBOTIS-GIT/turtlebot3_machine_learning) | 强化学习自主导航示例 |
| [ROBOTIS-GIT/turtlebot3_autorace](https://github.com/ROBOTIS-GIT/turtlebot3_autorace) | 小型自动驾驶赛道（车道线、红绿灯） |
| [ROBOTIS-GIT/turtlebot3_applications](https://github.com/ROBOTIS-GIT/turtlebot3_applications) | 跟随、巡逻等应用示例 |
| [ROBOTIS-GIT/turtlebot3_manipulation](https://github.com/ROBOTIS-GIT/turtlebot3_manipulation) | 加装机械臂的相关包 |

**Nav2 仓库：**

| 仓库 | 说明 |
|---|---|
| [ros-navigation/navigation2](https://github.com/ros-navigation/navigation2) | Nav2 主仓库 |

**AWS Gazebo 场景：**

| 仓库 | 场景 |
|---|---|
| [aws-robotics/aws-robomaker-small-house-world](https://github.com/aws-robotics/aws-robomaker-small-house-world) | 小型住宅 |
| [aws-robotics/aws-robomaker-hospital-world](https://github.com/aws-robotics/aws-robomaker-hospital-world) | 医院 |
| [aws-robotics/aws-robomaker-small-warehouse-world](https://github.com/aws-robotics/aws-robomaker-small-warehouse-world) | 仓库 |
| [aws-robotics/aws-robomaker-bookstore-world](https://github.com/aws-robotics/aws-robomaker-bookstore-world) | 书店 |

**Docker 镜像：**

| 镜像 | 说明 |
|---|---|
| `osrf/ros:humble-desktop-full` | OSRF 官方 ROS2 Humble 完整桌面版（本文档的基础镜像）|
| `robotis/turtlebot3:humble-latest` | ROBOTIS 官方 TurtleBot3 镜像 |

### 9.3 快速命令速查

**每次进入容器必做的 source：**
```bash
source /opt/ros/humble/setup.bash
source ~/turtlebot3_ws/install/setup.bash  # src 版
source ~/nav2_ws/install/setup.bash        # src 版
export TURTLEBOT3_MODEL=burger
```

**仿真启动命令：**
```bash
# 启动 Gazebo
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py

# 键盘遥控
ros2 run turtlebot3_teleop teleop_keyboard

# SLAM 建图
ros2 launch turtlebot3_cartographer cartographer.launch.py use_sim_time:=True

# 保存地图
ros2 run nav2_map_server map_saver_cli -f ~/workspace/maps/my_map

# 启动 Nav2
ros2 launch turtlebot3_navigation2 navigation2.launch.py \
    use_sim_time:=True \
    map:=~/workspace/maps/my_map.yaml
```

**容器管理命令：**
```bash
# 启动容器（主终端）
docker start -ai turtlebot3_apt       # 方案A
docker start -ai turtlebot3_src       # 方案B

# 开新终端进入同一容器
docker exec -it turtlebot3_apt bash   # 方案A
docker exec -it turtlebot3_src bash   # 方案B

# 停止容器
docker stop turtlebot3_apt
docker stop turtlebot3_src
```

### 9.4 学习资源

| 资源 | 链接 |
|---|---|
| ROBOTIS TurtleBot3 YouTube 播放列表 | https://www.youtube.com/playlist?list=PLRG6WP3c31_U7TFGduEIJWVtkOw6AJjFf |
| The Construct（在线 ROS2 课程） | https://www.theconstructsim.com/ |
| Udemy TurtleBot3 + Nav2 课程配套代码 | https://github.com/noshluk2/ROS2-Autonomous-Driving-and-Navigation-SLAM-with-TurtleBot3 |
| Nav2 官方文档（入门指南） | https://docs.nav2.org/getting_started/index.html |
| ROS2 工业工作坊 TurtleBot3 章节 | https://ros2-industrial-workshop.readthedocs.io/ |

---

> **文档结束**  
> 如遇问题，优先查阅第8章"常见问题排错"；仍未解决，可在 ROBOTIS Community Forum（https://forum.robotis.com/）或 ROS Discourse（https://discourse.ros.org/）提问。
