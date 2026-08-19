# Tracero TurtleBot3 源码镜像使用手册（B 成员）

> 编写日期：2026-08-19  
> 适用交付文件：`tracero_turtlebot3_agent_src_0.17-delivery.tar`  
> Docker 镜像：`tracero/turtlebot3-agent-src:0.17-delivery`  
> 当前状态：**本地可运行、待 A→B 联调版本**

本文供 Tracero 项目 B 成员直接操作。镜像包含 ROS 2 Humble、Gazebo 11、Nav2 源码工作空间、TurtleBot3 源码工作空间，以及已经编译的 Tracero Agent。B 可以只验证后端接口，也可以启动 TurtleBot3 Gazebo、Nav2 和 Agent 做完整环境检查。

本文中的 JSON 协议为 A、B 已确定的固定协议，不得自行增删或改名。

---

## 1. 交付物说明

B 应收到下面两个文件：

```text
tracero_turtlebot3_agent_src_0.17-delivery.tar
tracero_turtlebot3_agent_src_0.17-delivery.tar.sha256
```

其中：

- `.tar` 是使用 `docker save` 导出的完整 Docker 镜像；
- `.sha256` 用于确认传输前后的 tar 完全一致；
- tar 大小约为 2.29 GB；
- tar 导入后的镜像和运行容器还会占用更多空间。

镜像中的主要路径：

```text
/opt/ros/humble/                              ROS 2 Humble 基础环境
/root/turtlebot3_ws/src/                      TurtleBot3 源码
/root/turtlebot3_ws/install/                  TurtleBot3 编译结果
/root/nav2_ws/src/                            Nav2 源码
/root/nav2_ws/install/                        Nav2 编译结果
/root/workspace/tracero_agent_ws/src/         Tracero Agent 源码
/root/workspace/tracero_agent_ws/install/     Tracero Agent 编译结果
```

本 tar 的重点是机器人软件栈和 Agent。A 机器原本通过宿主机挂载使用的自定义 `maps/`、`tracero_tc01/` 和历史 `tracero_agent_data/` 不应默认视为已经包含在 tar 中。B 若要一比一复现 A 的动态墙体 TC-01，还需要向 A 单独取得经过清理的地图、模型和 TC-01 脚本。

不要把 tar 上传到公开 GitHub 仓库，也不要在未经团队同意的情况下再次公开分发。

---

## 2. 推荐运行环境

推荐：

```text
Windows 11
WSL2 Ubuntu 22.04
Docker Desktop（启用 WSL integration）
```

也可以使用原生 Ubuntu 22.04 + Docker Engine。

建议资源：

```text
内存：至少 8 GB，推荐 12 GB 以上
可用磁盘：至少 15～20 GB
CPU：4 核以上
图形环境：需要运行 Gazebo/RViz2 时必须可用
```

镜像是 Linux 镜像。检查 B 的 Docker 架构：

```bash
docker info --format 'os={{.OSType}} arch={{.Architecture}}'
```

通常应为：

```text
os=linux arch=x86_64
```

---

## 3. 检查 Docker 和 WSL

在 B 的 WSL Ubuntu 终端中执行：

```bash
docker version
```

再执行：

```bash
docker info
```

如果出现：

```text
Cannot connect to the Docker daemon
```

请先启动 Docker Desktop，并确认：

```text
Docker Desktop
→ Settings
→ Resources
→ WSL Integration
→ 已启用当前 Ubuntu-22.04
```

关闭并重新打开 WSL 终端后再次执行 `docker version`。

检查空间：

```bash
df -h ~
docker system df
```

不要为了腾空间直接运行 `docker system prune -a`，该命令可能删除 B 机器上其他项目仍需使用的镜像。

---

## 4. 把交付文件放入 WSL

如果文件在 Windows 下载目录，WSL 中一般对应：

```text
/mnt/c/Users/<Windows用户名>/Downloads/
```

创建接收目录：

```bash
mkdir -p ~/tracero_delivery
```

复制 tar 和校验文件，例如：

```bash
cp \
  /mnt/c/Users/<Windows用户名>/Downloads/tracero_turtlebot3_agent_src_0.17-delivery.tar \
  ~/tracero_delivery/
```

```bash
cp \
  /mnt/c/Users/<Windows用户名>/Downloads/tracero_turtlebot3_agent_src_0.17-delivery.tar.sha256 \
  ~/tracero_delivery/
```

进入目录：

```bash
cd ~/tracero_delivery
```

检查：

```bash
ls -lh
```

应同时看到 `.tar` 和 `.sha256`。

---

## 5. 导入前校验 tar

执行：

```bash
cd ~/tracero_delivery
```

```bash
sha256sum -c \
  tracero_turtlebot3_agent_src_0.17-delivery.tar.sha256
```

必须显示：

```text
tracero_turtlebot3_agent_src_0.17-delivery.tar: OK
```

如果显示 `FAILED`：

1. 不要继续 `docker load`；
2. 不要尝试修改 tar；
3. 重新从 A 获取文件；
4. 重新校验，直到显示 `OK`。

校验文件只证明传输一致，不代表镜像已经完成 A→B 正式联调。

---

## 6. 导入 Docker 镜像

执行：

```bash
docker load \
  -i tracero_turtlebot3_agent_src_0.17-delivery.tar
```

该步骤可能需要几分钟，而且不一定持续显示进度。成功后应出现：

```text
Loaded image: tracero/turtlebot3-agent-src:0.17-delivery
```

检查镜像：

```bash
docker image ls \
  tracero/turtlebot3-agent-src
```

检查详细信息：

```bash
docker image inspect \
  tracero/turtlebot3-agent-src:0.17-delivery \
  --format 'id={{.Id}} os={{.Os}} arch={{.Architecture}} size={{.Size}} created={{.Created}}'
```

如果 `docker load` 报磁盘不足，应先人工检查 `docker system df`，不要盲目删除其他项目镜像。

---

## 7. 导入后进行一次性验证

先不要创建长期容器。直接运行一次性检查：

```bash
docker run --rm \
  tracero/turtlebot3-agent-src:0.17-delivery \
  bash -lc '
    set -e

    source /opt/ros/humble/setup.bash
    source /root/turtlebot3_ws/install/setup.bash
    source /root/nav2_ws/install/setup.bash
    source /root/workspace/tracero_agent_ws/install/setup.bash

    ros2 pkg prefix nav2_bringup
    ros2 pkg prefix nav2_msgs
    ros2 pkg prefix turtlebot3_gazebo
    ros2 pkg prefix turtlebot3_navigation2
    ros2 pkg executables tracero_agent
    command -v gazebo
    ros2 pkg prefix gazebo_ros
    python3 -c "import requests; print(requests.__version__)"

    echo "镜像基础检查通过"
  '
```

关键结果应类似：

```text
/root/nav2_ws/install/nav2_bringup
/root/nav2_ws/install/nav2_msgs
/root/turtlebot3_ws/install/turtlebot3_gazebo
/root/turtlebot3_ws/install/turtlebot3_navigation2
tracero_agent agent_node
/usr/bin/gazebo
/opt/ros/humble
2.25.1
镜像基础检查通过
```

这里故意不执行 `gazebo --version`。在部分无图形终端中，该命令打印版本后可能不退出，导致后续检查看起来“消失”。`command -v gazebo` 与 `ros2 pkg prefix gazebo_ros` 已足够验证程序和 ROS 接口存在。

---

## 8. 创建 B 的长期容器

### 8.1 先确认没有同名容器

```bash
docker ps -a \
  --filter name=tracero_b
```

如果已有同名容器，不要直接重复 `docker run`。如果它就是之前创建的 B 测试容器，可以执行：

```bash
docker start tracero_b
```

如果不是本次容器，使用新名称，例如 `tracero_b_2`。

### 8.2 不需要 Gazebo/RViz2 图形界面

如果 B 只验证 Agent 和后端接口，执行：

```bash
docker run -d \
  --name tracero_b \
  --network host \
  -e ROS_DOMAIN_ID=30 \
  -e TURTLEBOT3_MODEL=burger \
  tracero/turtlebot3-agent-src:0.17-delivery \
  sleep infinity
```

### 8.3 需要 Gazebo/RViz2 图形界面

先检查：

```bash
echo "$DISPLAY"
ls -ld /tmp/.X11-unix
```

如果系统有 `xhost`，执行：

```bash
xhost +local:docker
```

然后创建容器：

```bash
docker run -d \
  --name tracero_b \
  --network host \
  -e DISPLAY="$DISPLAY" \
  -e ROS_DOMAIN_ID=30 \
  -e TURTLEBOT3_MODEL=burger \
  -e QT_X11_NO_MITSHM=1 \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  tracero/turtlebot3-agent-src:0.17-delivery \
  sleep infinity
```

检查：

```bash
docker ps --filter name=tracero_b
```

### 8.4 严禁覆盖镜像中的工作空间

创建容器时不要添加下列挂载：

```text
-v 某个目录:/root/workspace
-v 某个目录:/root/nav2_ws
-v 某个目录:/root/turtlebot3_ws
```

空目录或错误目录一旦挂载到上述位置，会把 tar 中已有源码和编译结果隐藏，随后出现 `Package not found`。

检查实际挂载：

```bash
docker inspect tracero_b \
  --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

图形模式下只应看到 `/tmp/.X11-unix` 相关挂载。

---

## 9. 每个终端都必须加载环境

进入容器：

```bash
docker exec -it tracero_b bash
```

每打开一个新的容器终端，都按下面顺序执行：

```bash
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
source /root/nav2_ws/install/setup.bash
source /root/workspace/tracero_agent_ws/install/setup.bash

export ROS_DOMAIN_ID=30
export TURTLEBOT3_MODEL=burger
```

顺序是：

```text
ROS 2 Humble
→ TurtleBot3 源码工作空间
→ Nav2 源码工作空间
→ Tracero Agent 工作空间
```

如果忘记加载 Nav2 或 TurtleBot3 工作空间，就会出现 `Package not found`，即使源码实际上存在。

检查当前环境：

```bash
echo "ROS_DISTRO=$ROS_DISTRO"
echo "ROS_DOMAIN_ID=$ROS_DOMAIN_ID"
echo "TURTLEBOT3_MODEL=$TURTLEBOT3_MODEL"
echo "$AMENT_PREFIX_PATH" | tr ':' '\n'
```

---

## 10. B 只做后端接口验证的最短路线

如果 B 当前只负责实现三个接收接口，不需要启动 Gazebo 和 Nav2，按本章操作即可。

### 10.1 B 启动后端

B 后端必须提供：

```text
POST /api/ingest/event
POST /api/ingest/params
POST /api/ingest/static_index
```

成功时应返回 HTTP 2xx。B 必须能够在日志或数据库中确认收到的 JSON 与请求内容一致。

### 10.2 检查后端地址

如果后端在同一 WSL 主机的 `8000` 端口，且容器使用 `--network host`：

```bash
curl -i http://127.0.0.1:8000
```

根路径返回 404 不一定表示服务失败；只要收到 HTTP 响应，通常说明端口可达。

### 10.3 启动 Agent 冒烟测试

进入容器：

```bash
docker exec -it tracero_b bash
```

加载环境：

```bash
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
source /root/nav2_ws/install/setup.bash
source /root/workspace/tracero_agent_ws/install/setup.bash
export ROS_DOMAIN_ID=30
```

检查默认配置：

```bash
sed -n '1,160p' \
  /root/workspace/tracero_agent_ws/src/tracero_agent/config/agent.yaml
```

默认应包含：

```yaml
robot_id: "tc-01"
static_index_version: "v1"
backend_url: "http://127.0.0.1:8000"
output_dir: "/root/workspace/tracero_agent_data"
```

启动：

```bash
ros2 launch tracero_agent agent.launch.py
```

期望看到：

```text
Tracero Agent 已启动。
robot_id=tc-01, static_index_version=v1
```

没有 Gazebo 时，Agent 缺少 `/scan`、`/odom` 等 topic 是正常的。后端未启动时出现 POST 网络失败也不应导致 Agent 退出。

停止 Agent：

```text
Ctrl+C
```

---

## 11. 不修改配置文件，临时指定 B 的地址

如果 B 的后端不是 `http://127.0.0.1:8000`，推荐运行时覆盖参数，不要把真实局域网地址固定进源码或 GitHub。

进入并加载环境后执行：

```bash
ros2 run tracero_agent agent_node \
  --ros-args \
  --params-file \
  /root/workspace/tracero_agent_ws/src/tracero_agent/config/agent.yaml \
  -p backend_url:="http://<B后端IP>:<端口>"
```

例如仅作为格式说明：

```text
http://192.168.1.20:8000
```

必须换成 B 的实际地址。不要把 Token、密码或密钥放入 URL。

如果 B 后端就在使用 `--network host` 的同一台主机，优先使用：

```text
http://127.0.0.1:8000
```

---

## 12. 固定 JSON 协议

### 12.1 异常事件

接口：

```text
POST /api/ingest/event
```

固定最小格式：

```json
{
  "event_type": "navigation_failed",
  "trigger_time": 1747000000.123,
  "robot_id": "tc-01",
  "window": {
    "pre_5s": [
      {
        "topic": "/scan",
        "timestamp": 1746999998.0,
        "data": {
          "age_ms": 800
        }
      }
    ],
    "post_2s": []
  },
  "params_snapshot": {},
  "static_index_version": "v1"
}
```

事件顶层字段必须是：

```text
event_type
trigger_time
robot_id
window
params_snapshot
static_index_version
```

窗口名保持：

```text
pre_5s
post_2s
```

每条窗口记录至少且按照当前 Agent 协议包含：

```text
topic
timestamp
data
```

不要加入 `goal_uuid`、`schema_version`、`test_case_id`、`before` 或 `after`。

### 12.2 参数快照

接口：

```text
POST /api/ingest/params
```

格式：

```json
{
  "timestamp": 1746999900.0,
  "params": {
    "controller_frequency": 20.0,
    "update_frequency": 5.0
  }
}
```

### 12.3 源码映射

接口：

```text
POST /api/ingest/static_index
```

格式：

```json
{
  "version": "v1",
  "index": {
    "/scan": {
      "publisher": {
        "node": "scan_publisher",
        "file": "src/scan_publisher.cpp",
        "line": 42,
        "snippet": "publisher_->publish(scan);"
      }
    }
  }
}
```

静态索引中的：

```json
"version": "v1"
```

必须与异常事件中的：

```json
"static_index_version": "v1"
```

完全一致。示例中的文件、行号和 snippet 只是格式说明，正式数据必须由 A 根据真实源码核实。

---

## 13. 用 curl 独立测试 B 的三个接口

B 可以先使用项目 GitHub 仓库中 `tracero_agent/examples/` 的 JSON 示例。不要使用聊天中重新手抄的版本替代实际示例文件。

假设：

```bash
export TRACERO_BACKEND_URL="http://127.0.0.1:8000"
```

事件：

```bash
curl -i -X POST \
  "$TRACERO_BACKEND_URL/api/ingest/event" \
  -H 'Content-Type: application/json' \
  --data-binary @examples/event_example.json
```

参数：

```bash
curl -i -X POST \
  "$TRACERO_BACKEND_URL/api/ingest/params" \
  -H 'Content-Type: application/json' \
  --data-binary @examples/params_example.json
```

静态索引：

```bash
curl -i -X POST \
  "$TRACERO_BACKEND_URL/api/ingest/static_index" \
  -H 'Content-Type: application/json' \
  --data-binary @examples/static_index_v1.example.json
```

检查标准：

- A/B 收到 HTTP 2xx；
- B 日志能看到请求；
- B 保存的 JSON 与发送文件一致；
- B 不自行重命名字段；
- 结构示例不能冒充真实源码映射。

HTTP 400/422 通常表示格式或字段不匹配；HTTP 500 通常表示 B 后端内部错误；连接拒绝通常表示地址、端口或服务状态有问题。

---

## 14. 启动完整 TurtleBot3、Gazebo、Nav2 和 Agent

完整运行建议使用四个或五个 WSL 终端。每个终端都通过 `docker exec` 进入同一个 `tracero_b` 容器。

### 14.1 Terminal 1：Gazebo

```bash
docker exec -it tracero_b bash
```

```bash
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
source /root/nav2_ws/install/setup.bash
export ROS_DOMAIN_ID=30
export TURTLEBOT3_MODEL=burger
```

启动标准 TurtleBot3 world：

```bash
ros2 launch \
  turtlebot3_gazebo \
  turtlebot3_world.launch.py
```

保持终端运行。

### 14.2 Terminal 2：Nav2 和 RViz2

先进入并加载同样的三个环境：

```bash
docker exec -it tracero_b bash
```

```bash
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
source /root/nav2_ws/install/setup.bash
export ROS_DOMAIN_ID=30
export TURTLEBOT3_MODEL=burger
```

查找镜像中可用的 TurtleBot3 地图：

```bash
find "$(ros2 pkg prefix --share turtlebot3_navigation2)" \
  -type f \
  \( -name '*.yaml' -o -name '*.yml' \) \
  -print
```

选择与标准 world 对应的地图，然后启动，例如：

```bash
ros2 launch \
  turtlebot3_navigation2 \
  navigation2.launch.py \
  use_sim_time:=True \
  map:=<上一步找到的地图yaml绝对路径>
```

不要照抄占位符 `<...>`，必须替换为实际路径。

### 14.3 Terminal 3：Tracero Agent

```bash
docker exec -it tracero_b bash
```

```bash
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
source /root/nav2_ws/install/setup.bash
source /root/workspace/tracero_agent_ws/install/setup.bash
export ROS_DOMAIN_ID=30
export TURTLEBOT3_MODEL=burger
```

启动：

```bash
ros2 launch tracero_agent agent.launch.py
```

约十秒后，Agent 健康日志中的 topic 数和缓冲记录数应逐渐增加。

### 14.4 Terminal 4：检查 ROS topic

```bash
docker exec -it tracero_b bash
```

加载全部环境后执行：

```bash
ros2 topic list | sort
```

检查关键 topic：

```bash
ros2 topic hz /scan
```

```bash
ros2 topic hz /odom
```

```bash
ros2 topic echo /cmd_vel --once
```

如果 Agent 的 `buffer_records` 始终为 0，应优先检查 `/scan`、`/odom`、ROS Domain ID 和加载顺序。

---

## 15. 检查 Agent 三个本地控制服务

Agent 运行后，在另一个已加载环境的容器终端执行：

```bash
ros2 service list | grep tracero_agent
```

应看到：

```text
/tracero_agent/injection
/tracero_agent/reset
/tracero_agent/status
```

查看状态：

```bash
ros2 service call \
  /tracero_agent/status \
  std_srvs/srv/Trigger \
  "{}"
```

开始新一轮前重置：

```bash
ros2 service call \
  /tracero_agent/reset \
  std_srvs/srv/Trigger \
  "{}"
```

只有在墙体或故障注入实际成功后，才调用：

```bash
ros2 service call \
  /tracero_agent/injection \
  std_srvs/srv/Trigger \
  "{}"
```

这些 ROS service 是 Agent 本机控制接口，不属于三个 HTTP JSON 请求体。

---

## 16. 检查 Agent 生成的数据

Agent 数据目录：

```text
/root/workspace/tracero_agent_data
```

检查：

```bash
find /root/workspace/tracero_agent_data \
  -maxdepth 2 -type f | sort
```

常见子目录：

```text
events/        尚未成功发送的事件
sent/          已成功发送的事件
failed/        协议错误或被后端拒绝的事件
params/        参数快照
static_index/  源码映射
logs/          Agent 日志
```

查找最新事件：

```bash
AGENT_EVENT_FILE="$(find /root/workspace/tracero_agent_data/events \
  /root/workspace/tracero_agent_data/sent \
  -maxdepth 1 -type f -name '*.json' \
  -printf '%T@ %p\n' 2>/dev/null \
  | sort -nr | head -n1 | cut -d' ' -f2-)"
```

```bash
echo "$AGENT_EVENT_FILE"
python3 -m json.tool "$AGENT_EVENT_FILE"
```

不要手工修改 Agent 实际生成文件后再声称它是原始运行数据。

---

## 17. B 的接口验收记录

每轮测试建议记录：

```text
测试日期和时间：
镜像 ID：
容器名称：
ROS_DOMAIN_ID：
后端基础地址：
event HTTP 状态码：
params HTTP 状态码：
static_index HTTP 状态码：
B 是否保存完整 JSON：
B 是否关联最近参数：
B 是否通过 v1 找到静态索引：
异常或备注：
```

正式 A→B 联调应连续完成三轮。三轮通过前，版本仍称为：

```text
本地可运行、待 A→B 联调版本
```

---

## 18. 安全停止与下次恢复

### 18.1 停止顺序

依次进入对应终端并按一次 `Ctrl+C`：

```text
Tracero Agent
→ Nav2/RViz2
→ Gazebo
→ rosbag（如有）
```

等待每个终端重新出现命令提示符。

停止长期容器：

```bash
docker stop tracero_b
```

检查：

```bash
docker ps --filter name=tracero_b
```

不要执行：

```bash
docker rm tracero_b
```

除非已经确认容器内产生的数据不再需要。删除容器会删除它的可写层数据。

### 18.2 下次恢复

```bash
docker start tracero_b
```

进入：

```bash
docker exec -it tracero_b bash
```

重新加载四个环境并启动需要的程序。

---

## 19. 常见问题

### 19.1 `Package not found`

最常见原因是漏掉 `source`。执行：

```bash
source /opt/ros/humble/setup.bash
source /root/turtlebot3_ws/install/setup.bash
source /root/nav2_ws/install/setup.bash
source /root/workspace/tracero_agent_ws/install/setup.bash
```

然后重新检查。

### 19.2 容器里看不到 `/root/workspace`

检查是否错误挂载了空目录：

```bash
docker inspect tracero_b \
  --format '{{range .Mounts}}{{println .Source "->" .Destination}}{{end}}'
```

不要把宿主机空目录挂载到 `/root/workspace`。

### 19.3 Gazebo 窗口不显示

检查：

```bash
echo "$DISPLAY"
ls -la /tmp/.X11-unix
docker inspect tracero_b \
  --format '{{range .Config.Env}}{{println .}}{{end}}' \
  | grep DISPLAY
```

容器创建时必须传递 `DISPLAY` 并挂载 `/tmp/.X11-unix`。如果使用原生 Linux，也需允许本地 Docker 访问 X Server。

### 19.4 `gazebo --version` 打印后没有返回

按一次 `Ctrl+C`。无图形终端中不使用它作为严格自动检查。改用：

```bash
command -v gazebo
ros2 pkg prefix gazebo_ros
```

### 19.5 Agent 启动后一直提示后端连接失败

检查：

```bash
curl -i http://<B后端IP>:<端口>
```

确认：

- B 后端正在监听；
- IP 和端口正确；
- 防火墙没有阻断；
- 容器网络模式正确；
- 配置中没有把示例地址当成真实地址。

后端暂时不可用时，Agent 应保存本地文件并重试，不应崩溃。

### 19.6 Agent 因 `/diagnostics` 崩溃

当前交付源码已经包含 ROS 2 Humble 单字节兼容处理：

```python
def uint8_value(value):
    if isinstance(value, (bytes, bytearray)):
        return value[0] if value else 0
    return int(value)
```

以及：

```python
levels = [uint8_value(item.level) for item in message.status]
```

如果 B 使用了旧代码副本，应以交付镜像中的 Agent 源码为准。

### 19.7 容器退出码 137

通常表示容器被强制终止或内存不足。检查：

```bash
docker inspect tracero_b \
  --format 'oom={{.State.OOMKilled}} exit={{.State.ExitCode}}'
```

停止不必要程序，提高 Docker Desktop/WSL 可用内存，再重新启动。

### 19.8 没有 A 的自定义地图或动态墙体脚本

这是可能的正常情况。该 tar 的目标是共享源码机器人栈和 Tracero Agent；A 原来挂载到 `/root/workspace` 的 TC-01 资产不会自动进入 `docker commit`。B 若要复现完整 TC-01，应向 A 索取经过清理的：

```text
maps/
tracero_tc01/models/
tracero_tc01/scripts/
```

不要使用历史日志、事件数据或包含敏感信息的整个工作目录替代。

---

## 20. B 最终验收清单

### 镜像和容器

- [ ] SHA-256 校验结果为 `OK`；
- [ ] `docker load` 成功；
- [ ] 镜像标签为 `tracero/turtlebot3-agent-src:0.17-delivery`；
- [ ] 容器没有错误覆盖 `/root/workspace`、`/root/nav2_ws` 或 `/root/turtlebot3_ws`；
- [ ] B 知道当前版本不是正式稳定版。

### 源码环境

- [ ] `nav2_bringup` 指向 `/root/nav2_ws/install/...`；
- [ ] `nav2_msgs` 指向 `/root/nav2_ws/install/...`；
- [ ] `turtlebot3_gazebo` 指向 `/root/turtlebot3_ws/install/...`；
- [ ] `turtlebot3_navigation2` 指向 `/root/turtlebot3_ws/install/...`；
- [ ] `tracero_agent agent_node` 能被发现；
- [ ] `gazebo_ros` 能被发现；
- [ ] `requests` 可以导入。

### B 后端

- [ ] `/api/ingest/event` 返回 2xx；
- [ ] `/api/ingest/params` 返回 2xx；
- [ ] `/api/ingest/static_index` 返回 2xx；
- [ ] B 保存的 JSON 与 A 发送文件一致；
- [ ] B 没有修改约定字段；
- [ ] `static_index_version=v1` 能关联 `version=v1`；
- [ ] 失败请求有可查看的日志。

### 联调

- [ ] A 和 B 使用一致的后端地址及端口；
- [ ] A 和 B 使用一致的 ROS Domain ID（需要跨 ROS 环境通信时）；
- [ ] Agent 能采集关键 topic；
- [ ] 参数快照能被 B 接收；
- [ ] 异常事件能被 B 接收；
- [ ] 连续三轮真实 A→B 测试通过后，才更新版本状态。

全部检查完成后，B 将接口结果、日志位置和问题清单反馈给 A。任何协议解析问题都应先对照第 12 章固定 JSON 协议，不自行改名或增加字段。
