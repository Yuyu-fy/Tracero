export type RunStatus = 'reasoning' | 'done' | 'failed'
export type UserRole = 'dev' | 'test' | 'ops'

export const stats = {
  reasoning: 1,
  completed: 5,
  failed: 0,
}

export const runs = [
  {
    run_id: 'run_20260527_143207',
    event_type: '导航失败',
    trigger_time: '14:32:07',
    status: 'reasoning' as RunStatus,
    summary: 'costmap 更新延迟导致导航失败',
    robot: 'robot_001',
  },
  {
    run_id: 'run_20260527_131544',
    event_type: '急停触发',
    trigger_time: '13:15:44',
    status: 'done' as RunStatus,
    summary: '速度异常导致急停',
    robot: 'robot_001',
  },
  {
    run_id: 'run_20260527_110821',
    event_type: '路径重规划',
    trigger_time: '11:08:21',
    status: 'done' as RunStatus,
    summary: '目标点不可达，重新规划路径',
    robot: 'robot_002',
  },
  {
    run_id: 'run_20260526_094412',
    event_type: '导航失败',
    trigger_time: '昨天 09:44',
    status: 'done' as RunStatus,
    summary: '传感器丢帧导致定位偏差',
    robot: 'robot_001',
  },
  {
    run_id: 'run_20260526_083001',
    event_type: '参数异常',
    trigger_time: '昨天 08:30',
    status: 'done' as RunStatus,
    summary: 'inflation_radius 设置过小，路径规划失败',
    robot: 'robot_002',
  },
  {
    run_id: 'run_20260525_213000',
    event_type: '地图加载',
    trigger_time: '5月25日 21:30',
    status: 'failed' as RunStatus,
    summary: '地图文件缺失，推理任务未启动',
    robot: 'robot_003',
  },
]

export const currentRun = {
  run_id: 'run_20260527_143207',
  event_type: '导航失败',
  trigger_time: '14:32:07',
  status: 'reasoning' as RunStatus,
  robot: 'robot_001',
  conclusion: {
    fact: 'costmap 更新延迟 340ms，障碍物出现时局部代价地图未能及时更新 [E-03]',
    reasoning:
      'controller_server.cpp 第 387 行 [E-02] 在生成速度指令时读取的是 340ms 前的旧地图，障碍物信息未传达至规划模块，导致未能刹车',
    suggestion:
      '建议将 update_frequency 从 5.0 Hz 调高到 10.0 Hz，或排查 LiDAR 数据传输延迟原因',
  },
  chatHistory: [
    {
      role: 'user' as const,
      content: 'inflation_radius 在哪定义的？',
    },
    {
      role: 'ai' as const,
      content:
        'inflation_radius 定义在 nav2_params.yaml 第 45 行，当前值为 0.55。这个参数控制障碍物膨胀半径，影响路径规划时对障碍物的避让距离。',
    },
    {
      role: 'user' as const,
      content: 'update_frequency 现在是多少？',
    },
    {
      role: 'ai' as const,
      content:
        'update_frequency 当前值为 5.0 Hz，定义在 nav2_params.yaml 第 23 行。这意味着局部代价地图每 200ms 更新一次，在高速场景下可能出现更新延迟。',
    },
  ],
}

export const roleLabels: Record<UserRole, string> = {
  dev: '开发',
  test: '测试',
  ops: '运维',
}

export const statusLabels: Record<RunStatus, string> = {
  reasoning: '推理中',
  done: '已完成',
  failed: '失败',
}
