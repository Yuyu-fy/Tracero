# Tracero TC-01 rosbag 数据接收与使用完整指南

> 适用对象：收到 A 同学提供的 TC-01 数据包，需要检查、回放、分析或接入 B 模块 Evidence Builder 的团队成员。
>
> 适用环境：Ubuntu 22.04 / WSL2 + ROS 2 Humble。推荐使用与数据生产端一致的 turtlebot3_src 容器。
>
> 安全原则：rosbag 必须以完整目录交付；回放使用独立 ROS_DOMAIN_ID，避免历史 /cmd_vel 控制正在运行的机器人或仿真。

---

## 目录

1. 数据包内容
2. 环境准备
3. 校验与解压
4. 检查 rosbag
5. 安全回放
6. 查看 status 和 feedback
7. 查看速度、位置和传感器
8. 使用 RViz2 可视化
9. 判断 TC-01 结果
10. 提供给 B 模块
11. 常见问题
12. 接收验收清单

---

## 1. 数据包内容

发送者通常提供：

~~~text
tc01_YYYYMMDD_HHMMSS.tar.gz
tc01_YYYYMMDD_HHMMSS.tar.gz.sha256
~~~

解压后的推荐结构：

~~~text
tc01_YYYYMMDD_HHMMSS/
├── metadata.yaml
└── *.db3

tc01_YYYYMMDD_HHMMSS_events.txt
tc01_YYYYMMDD_HHMMSS_README.md
models/tc01_wall/model.sdf
scripts/spawn_tc01_wall.sh
scripts/reset_tc01.sh
turtlebot3_map_v2.yaml
turtlebot3_map_v2.pgm
~~~

各文件用途：

| 文件 | 用途 |
|---|---|
| metadata.yaml | rosbag 的主题、类型、消息数和时长 |
| *.db3 | 实际 ROS 2 消息 |
| events.txt | 墙体注入、卡住和超时的人工事件时间 |
| README.md | 本次运行配置和判断规则 |
| model.sdf | 动态墙体尺寸 |
| spawn/reset 脚本 | 复现 TC-01 |
| 地图 yaml/pgm | 复现导航环境 |

不要只接收 .db3。缺少 metadata.yaml 时，ros2 bag info 和 ros2 bag play 通常无法工作。

---

## 2. 环境准备

### 2.1 所需软件

接收者至少需要：

~~~text
Ubuntu 22.04
ROS 2 Humble
rosbag2
action_msgs
nav2_msgs
nav_msgs
sensor_msgs
geometry_msgs
tf2_msgs
~~~

验证：

~~~bash
source /opt/ros/humble/setup.bash

ros2 bag --help
ros2 interface show action_msgs/msg/GoalStatusArray
ros2 interface show nav2_msgs/action/NavigateToPose
~~~

如果使用项目容器：

~~~bash
docker start turtlebot3_src
docker exec -it turtlebot3_src bash
~~~

检查、解压和普通回放不需要启动 Gazebo 或 Nav2。只有图形化查看时才需要 RViz2。

### 2.2 建立接收目录

容器内执行：

~~~bash
mkdir -p /root/workspace/tracero_tc01/received
~~~

该目录对应 WSL：

~~~text
/home/messi/workspace/turtlebot3_src/home/tracero_tc01/received
~~~

Windows 文件资源管理器可访问：

~~~text
\\wsl.localhost\Ubuntu-22.04\home\messi\workspace\turtlebot3_src\home\tracero_tc01\received
~~~

---

## 3. 校验与解压

以下示例使用 tc01_20260808_143207，请替换为真实时间戳。

### 3.1 校验 SHA-256

进入接收目录：

~~~bash
cd /root/workspace/tracero_tc01/received
ls -lh
~~~

查看发送者校验值：

~~~bash
cat tc01_20260808_143207.tar.gz.sha256
~~~

重新计算：

~~~bash
sha256sum tc01_20260808_143207.tar.gz
~~~

比较两行开头的 64 位哈希。完全一致表示传输未损坏。

如果校验文件记录的是相对文件名，可直接执行：

~~~bash
sha256sum -c tc01_20260808_143207.tar.gz.sha256
~~~

期望：

~~~text
tc01_20260808_143207.tar.gz: OK
~~~

校验失败时停止分析，让发送者重新上传。

### 3.2 解压

建立独立目录：

~~~bash
mkdir -p /root/workspace/tracero_tc01/received/tc01_20260808_143207_package
~~~

解压：

~~~bash
tar -xzf /root/workspace/tracero_tc01/received/tc01_20260808_143207.tar.gz \
  -C /root/workspace/tracero_tc01/received/tc01_20260808_143207_package
~~~

查看文件：

~~~bash
find /root/workspace/tracero_tc01/received/tc01_20260808_143207_package \
  -maxdepth 4 -type f | sort
~~~

设置后续变量：

~~~bash
TC01_PACKAGE_DIR="/root/workspace/tracero_tc01/received/tc01_20260808_143207_package"
TC01_BAG_DIR="$TC01_PACKAGE_DIR/tc01_20260808_143207"
~~~

---

## 4. 检查 rosbag

### 4.1 检查目录

~~~bash
ls -lah "$TC01_BAG_DIR"
~~~

必须包含：

~~~text
metadata.yaml
至少一个 .db3 文件
~~~

### 4.2 查看元数据

~~~bash
ros2 bag info "$TC01_BAG_DIR"
~~~

重点查看：

~~~text
Duration
Start
End
Messages
Topic information
Message Count
~~~

TC-01 推荐包含：

~~~text
/clock
/tf
/tf_static
/map
/amcl_pose
/scan
/odom
/cmd_vel
/local_costmap/costmap
/global_costmap/costmap
/plan
/navigate_to_pose/_action/status
/navigate_to_pose/_action/feedback
~~~

status 和 feedback 必须存在且消息数大于 0。否则仍可分析运动与传感器数据，但无法可靠使用 distance_remaining、number_of_recoveries 和 goal 状态判断 TC-01。

### 4.3 查看事件记录

~~~bash
cat "$TC01_PACKAGE_DIR/tc01_20260808_143207_events.txt"
~~~

可能包含：

~~~text
[wall_injected]
[navigation_stuck]
[navigation_stuck_timeout]
~~~

阅读运行说明：

~~~bash
cat "$TC01_PACKAGE_DIR/tc01_20260808_143207_README.md"
~~~

---

## 5. 安全回放

### 5.1 使用独立 ROS 域

bag 包含 /cmd_vel。直接在运行中的机器人或 Gazebo 所在域回放，可能再次驱动机器人。

生产环境使用 30，回放统一使用：

~~~text
ROS_DOMAIN_ID=31
~~~

### 5.2 Terminal A：观察

~~~bash
docker exec -it turtlebot3_src bash
export ROS_DOMAIN_ID=31
echo "$ROS_DOMAIN_ID"
~~~

期望输出 31。

### 5.3 Terminal B：回放

~~~bash
docker exec -it turtlebot3_src bash
export ROS_DOMAIN_ID=31

TC01_PACKAGE_DIR="/root/workspace/tracero_tc01/received/tc01_20260808_143207_package"
TC01_BAG_DIR="$TC01_PACKAGE_DIR/tc01_20260808_143207"
~~~

每次新进入容器后，.bashrc 可能重新将域设为 30，因此两个回放终端都要重新执行 export ROS_DOMAIN_ID=31。

使用 31 后，即使 Gazebo 仍在域 30 运行，bag 中的历史 /cmd_vel 也不会控制它。

---

## 6. 查看 status 和 feedback

操作规律：

1. Terminal A 先执行 ros2 topic echo。
2. Terminal B 再执行 ros2 bag play。
3. 播放结束后在 Terminal A 按 Ctrl+C。
4. 需要看另一个字段时重新播放一次。

### 6.1 查看完整 feedback

Terminal A：

~~~bash
ros2 topic echo /navigate_to_pose/_action/feedback
~~~

Terminal B：

~~~bash
ros2 bag play "$TC01_BAG_DIR" \
  --rate 0.5 \
  --topics /navigate_to_pose/_action/feedback
~~~

重点字段：

~~~text
goal_id.uuid
feedback.navigation_time
feedback.number_of_recoveries
feedback.distance_remaining
~~~

### 6.2 只看剩余距离

Terminal A：

~~~bash
ros2 topic echo /navigate_to_pose/_action/feedback \
  --field feedback.distance_remaining
~~~

Terminal B 重新播放 feedback：

~~~bash
ros2 bag play "$TC01_BAG_DIR" \
  --rate 0.5 \
  --topics /navigate_to_pose/_action/feedback
~~~

墙体注入后若 distance_remaining 长期基本不下降，说明机器人没有取得有效目标进展。

### 6.3 只看恢复次数

Terminal A：

~~~bash
ros2 topic echo /navigate_to_pose/_action/feedback \
  --field feedback.number_of_recoveries
~~~

Terminal B 再次播放 feedback。恢复次数持续增加、剩余距离不下降，是“反复恢复但无法通过”的直接证据。

### 6.4 查看 action 状态

Terminal A：

~~~bash
ros2 topic echo /navigate_to_pose/_action/status
~~~

Terminal B：

~~~bash
ros2 bag play "$TC01_BAG_DIR" \
  --rate 0.5 \
  --topics /navigate_to_pose/_action/status
~~~

状态含义：

| 状态码 | 含义 | TC-01 解释 |
|---:|---|---|
| 2 | EXECUTING | action 仍在执行；可能正常，也可能卡住 |
| 4 | SUCCEEDED | 成功到达 |
| 5 | CANCELED | 被用户或 Watchdog 取消 |
| 6 | ABORTED | Nav2 正式判定失败 |

status 可能包含多个历史 goal。必须使用 goal_id.uuid 将 status 与 feedback 对齐，不要只读取列表第一项。

---

## 7. 查看速度、位置和传感器

### 7.1 查看速度指令

Terminal A：

~~~bash
ros2 topic echo /cmd_vel
~~~

Terminal B：

~~~bash
ros2 bag play "$TC01_BAG_DIR" --rate 0.5 --topics /cmd_vel
~~~

解释：

~~~text
linear.x > 0：前进
linear.x 约等于 0：停止平移
angular.z 不等于 0：转向或恢复旋转
~~~

持续旋转不代表接近目标。

### 7.2 查看里程计位置

Terminal A：

~~~bash
ros2 topic echo /odom --field pose.pose.position
~~~

Terminal B：

~~~bash
ros2 bag play "$TC01_BAG_DIR" --rate 0.5 --topics /odom
~~~

机器人原地恢复时，x/y 可能基本不变，但 angular.z 和方向持续变化。

### 7.3 检查雷达频率

Terminal A：

~~~bash
ros2 topic hz /scan
~~~

Terminal B：

~~~bash
ros2 bag play "$TC01_BAG_DIR" --topics /scan
~~~

持续收到 /scan 表示感知数据已保存。LaserScan 消息较大，不建议长时间完整 echo。

---

## 8. 使用 RViz2 可视化

### 8.1 启动隔离 RViz2

Terminal A：

~~~bash
export ROS_DOMAIN_ID=31
rviz2 --ros-args -p use_sim_time:=true
~~~

将 Fixed Frame 设置为：

~~~text
map
~~~

建议添加：

| Display | Topic |
|---|---|
| Map | /map |
| LaserScan | /scan |
| Path | /plan |
| TF | TF tree |
| Map | /local_costmap/costmap |
| Map | /global_costmap/costmap |

### 8.2 回放可视化数据

Terminal B：

~~~bash
export ROS_DOMAIN_ID=31

ros2 bag play "$TC01_BAG_DIR" \
  --clock \
  --rate 0.5 \
  --topics \
  /clock \
  /tf \
  /tf_static \
  /map \
  /scan \
  /plan \
  /local_costmap/costmap \
  /global_costmap/costmap
~~~

观察：

- 激光是否检测到动态墙；
- local costmap 是否形成障碍区域；
- global path 是否仍穿过墙或发生重规划；
- 激光、地图和 TF 是否对齐。

如果 RViz2 显示 No transform，确认回放包含 /tf、/tf_static 和 /clock，并确认 RViz2 已启用 use_sim_time。

---

## 9. 判断 TC-01 结果

TC-01 不要求 Nav2 必须进入 ABORTED。Tracero 使用运行时数据自行定义异常。

### 9.1 navigation_stuck

满足：

~~~text
墙体已注入
同一个 goal UUID 的 status 持续为 2
15 秒内 distance_remaining 减少不足 0.2m
/scan 或 local costmap 存在障碍证据
~~~

判定：

~~~text
navigation_stuck
~~~

### 9.2 navigation_stuck_timeout

注入后持续 60 秒仍然：

~~~text
status=2
distance_remaining 没有有效下降
机器人反复旋转、后退或重新规划
~~~

判定：

~~~text
navigation_stuck_timeout
~~~

### 9.3 navigation_failed

同一 goal 最终 status=6，则在原 navigation_stuck 事件上升级为：

~~~text
navigation_failed
~~~

### 9.4 navigation_recovered

卡住后最终 status=4，则标记：

~~~text
navigation_recovered
~~~

---

## 10. 提供给 B 模块

B 模块至少需要：

~~~text
run_id
robot_id
event_type
wall_injection_time
trigger_time
goal_uuid
status
distance_remaining
number_of_recoveries
pre_5s
post_2s
params_snapshot
static_index_version
~~~

建议从 bag 中围绕 trigger_time 截取：

~~~text
触发前 5 秒
触发后 2 秒
~~~

关键 topic：

~~~text
/scan
/odom
/cmd_vel
/local_costmap/costmap
/global_costmap/costmap
/plan
/navigate_to_pose/_action/status
/navigate_to_pose/_action/feedback
~~~

使用 events.txt 中的墙体注入时间作为事件锚点。需要严格对齐仿真时间时结合 bag 中的 /clock，不要只依赖文件创建时间。

推荐事件摘要：

~~~json
{
  "event_type": "navigation_stuck",
  "status": 2,
  "window_sec": 15.0,
  "min_goal_progress_m": 0.2,
  "evidence": {
    "distance_remaining_not_decreasing": true,
    "recoveries_increasing": true,
    "obstacle_visible_in_scan_or_costmap": true
  }
}
~~~

ABORTED 是后续失败证据，不是 navigation_stuck 成立的必要条件。

---

## 11. 常见问题

### 11.1 ros2 bag info 找不到 bag

必须传入包含 metadata.yaml 的目录：

~~~bash
ros2 bag info /path/to/tc01_YYYYMMDD_HHMMSS
~~~

不要传入单个 .db3 文件。

### 11.2 缺少 status 或 feedback

用 ros2 bag info 检查。若不存在，发送者录制时可能没有加入：

~~~bash
--include-hidden-topics
~~~

接收端无法恢复从未录制的消息，应要求重新录制。

### 11.3 回放时 echo 没有数据

确认两个终端都执行：

~~~bash
export ROS_DOMAIN_ID=31
~~~

先启动 echo，再启动 play。bag 较短时使用 --rate 0.5 降低速度。

### 11.4 缺少消息类型

~~~bash
source /opt/ros/humble/setup.bash
source ~/turtlebot3_ws/install/setup.bash
source ~/nav2_ws/install/setup.bash

ros2 interface show nav2_msgs/action/NavigateToPose
~~~

### 11.5 回放影响了机器人

立即在播放终端按 Ctrl+C。以后确认回放域为 31，生产或仿真域为 30。

### 11.6 metadata.yaml 缺失

这通常表示录制结束时直接关闭终端，rosbag 没有完成收尾。优先要求发送者提供完整 bag。不要直接修改原始 .db3；若尝试恢复，应先复制整个目录，再在副本上执行 rosbag2 reindex。

---

## 12. 接收验收清单

- [ ] SHA-256 与发送者一致；
- [ ] 压缩包可以解压；
- [ ] bag 包含 metadata.yaml 和 .db3；
- [ ] ros2 bag info 可以读取；
- [ ] status 和 feedback 消息数大于 0；
- [ ] events.txt 包含墙体注入时间；
- [ ] feedback 包含 distance_remaining 和 number_of_recoveries；
- [ ] status 与 feedback 能通过 goal UUID 对齐；
- [ ] /scan 或 costmap 中存在墙体障碍证据；
- [ ] 回放使用 ROS_DOMAIN_ID=31；
- [ ] 已判断 navigation_stuck、navigation_stuck_timeout、navigation_failed 或 navigation_recovered；
- [ ] 已向发送者反馈缺失 topic、损坏或时间信息问题。

---

## 最小快速流程

只需快速确认数据时：

~~~bash
# 解压
mkdir -p ./tc01_package
tar -xzf tc01_YYYYMMDD_HHMMSS.tar.gz -C ./tc01_package

# 检查
ros2 bag info ./tc01_package/tc01_YYYYMMDD_HHMMSS

# 隔离回放
export ROS_DOMAIN_ID=31
ros2 bag play ./tc01_package/tc01_YYYYMMDD_HHMMSS \
  --rate 0.5 \
  --topics \
  /navigate_to_pose/_action/status \
  /navigate_to_pose/_action/feedback
~~~

另一终端同样设置 ROS_DOMAIN_ID=31，再用 ros2 topic echo 查看对应 topic。

