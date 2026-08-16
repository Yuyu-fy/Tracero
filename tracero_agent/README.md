# Tracero Agent

Tracero Agent 是运行在 Machine A 上的 ROS 2 Python 节点，用于订阅 TurtleBot3/Nav2 关键 topic、维护异常前后时间窗口，并将异常事件发送给 Machine B。

## 当前状态

当前开发完成到 `agent.md` 第 0.17 节：

- Agent 可以启动；
- 可以订阅关键 ROS 2 topic；
- 可以维护 `pre_5s` 和 `post_2s`；
- 可以检测 `navigation_stuck`、`navigation_failed`；
- 可以按照固定 JSON 协议生成本地事件；
- 已完成本地 TC-01 测试；
- 尚未完成第 0.18 节 A→B 正式联调。

当前版本状态：

`本地可运行、待 A→B 联调版本`

## 环境

- Ubuntu 22.04
- ROS 2 Humble
- Python 3.10
- TurtleBot3 Burger
- Nav2
- Gazebo

## JSON 接口

Agent 使用以下固定接口：

- `POST /api/ingest/event`
- `POST /api/ingest/params`
- `POST /api/ingest/static_index`

协议示例位于 `examples/`。

## 编译

```bash
mkdir -p ~/tracero_agent_ws/src
cd ~/tracero_agent_ws/src
git clone https://github.com/Yuyu-fy/Tracero.git Tracero

cd ~/tracero_agent_ws
source /opt/ros/humble/setup.bash

colcon build \
  --symlink-install \
  --packages-select tracero_agent

source install/setup.bash
```

## 启动

```bash
ros2 launch tracero_agent agent.launch.py
```

## 本地控制服务

- `/tracero_agent/injection`
- `/tracero_agent/reset`
- `/tracero_agent/status`

墙体生成成功后通知 Agent：

```bash
ros2 service call \
  /tracero_agent/injection \
  std_srvs/srv/Trigger \
  "{}"
```

开始下一轮前重置：

```bash
ros2 service call \
  /tracero_agent/reset \
  std_srvs/srv/Trigger \
  "{}"
```

## 配置

配置文件：`config/agent.yaml`

默认后端地址：`http://127.0.0.1:8000`

联调时需要将其替换为 Machine B 的真实地址。

## 注意

- `examples/static_index_v1.example.json` 只是协议示例；
- 当前尚未上传经过源码核实的真实 `v1` 静态索引；
- 不要在仓库中提交密码、Token、真实事件目录或 rosbag。
