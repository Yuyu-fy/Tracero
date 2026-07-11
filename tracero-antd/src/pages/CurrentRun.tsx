import { useState } from 'react'
import {
  Avatar,
  Button,
  Input,
  Progress,
  Tag,
  Typography,
} from 'antd'
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CodeOutlined,
  FileTextOutlined,
  LoadingOutlined,
  RobotOutlined,
  SendOutlined,
  WarningFilled,
} from '@ant-design/icons'
import { currentRun } from '../mockData'
import './CurrentRun.css'

const { TextArea } = Input

type ChatMessage = {
  role: 'user' | 'ai'
  content: string
}

const timelineItems = [
  {
    time: '14:32:07.000',
    title: '导航失败触发',
    description: '局部规划器未输出有效速度指令',
    status: 'error',
  },
  {
    time: '14:32:07.086',
    title: '采集运行上下文',
    description: '已关联 4 个节点、18 条日志',
    status: 'done',
  },
  {
    time: '14:32:07.214',
    title: '定位异常窗口',
    description: '锁定 costmap 更新延迟',
    status: 'done',
  },
  {
    time: '14:32:07.482',
    title: '构建证据链',
    description: '正在核验参数与源码调用',
    status: 'active',
  },
  {
    time: '--:--:--',
    title: '生成处置建议',
    description: '等待证据链收敛',
    status: 'pending',
  },
] as const

const evidenceItems = [
  {
    id: 'E-01',
    type: '运行日志',
    source: '/controller_server',
    time: '14:32:06.948',
    content: 'Control loop missed its desired rate of 20.0000Hz',
    detail: '控制循环耗时 340ms，超过 50ms 的目标周期。',
    confidence: 98,
    tone: 'red',
    icon: <WarningFilled />,
  },
  {
    id: 'E-02',
    type: '源码定位',
    source: 'controller_server.cpp:387',
    time: '14:32:07.031',
    content: 'getRobotPose() 读取到上一周期的局部代价地图',
    detail: '速度指令生成时使用了 340ms 前的旧地图。',
    confidence: 94,
    tone: 'blue',
    icon: <CodeOutlined />,
  },
  {
    id: 'E-03',
    type: '指标异常',
    source: '/local_costmap',
    time: '14:32:07.104',
    content: 'costmap_update_latency = 340ms',
    detail: '延迟峰值显著高于近 10 分钟基线 82ms。',
    confidence: 96,
    tone: 'orange',
    icon: <ClockCircleOutlined />,
  },
  {
    id: 'E-04',
    type: '参数配置',
    source: 'nav2_params.yaml:23',
    time: '当前配置',
    content: 'update_frequency: 5.0',
    detail: '更新间隔为 200ms，高速场景下容错空间不足。',
    confidence: 88,
    tone: 'purple',
    icon: <FileTextOutlined />,
  },
] as const

export default function CurrentRun() {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(
    currentRun.chatHistory as ChatMessage[],
  )
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  function handleSend() {
    const content = inputValue.trim()
    if (!content || isLoading) return

    setChatHistory((prev) => [...prev, { role: 'user', content }])
    setInputValue('')
    setIsLoading(true)

    window.setTimeout(() => {
      setChatHistory((prev) => [
        ...prev,
        {
          role: 'ai',
          content:
            '根据当前证据，问题与 costmap 更新机制有关。建议先检查 nav2_params.yaml 中的 update_frequency，并同步排查 LiDAR 数据链路延迟。',
        },
      ])
      setIsLoading(false)
    }, 1000)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <section className="reasoning-workspace">
      <header className="reasoning-header">
        <div>
          <div className="reasoning-eyebrow">
            <span className="live-dot" />
            实时推理任务
            <span className="run-id">{currentRun.run_id}</span>
          </div>
          <div className="reasoning-title-row">
            <h1>{currentRun.event_type}</h1>
            <Tag color="error" bordered={false}>高优先级</Tag>
            <Tag color="processing" icon={<LoadingOutlined />}>推理中</Tag>
          </div>
        </div>
        <div className="reasoning-progress">
          <div className="progress-copy">
            <span>推理进度</span>
            <strong>72%</strong>
          </div>
          <Progress percent={72} showInfo={false} strokeColor="#1677ff" />
        </div>
      </header>

      <div className="reasoning-grid">
        <aside className="workspace-panel timeline-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">EVENT FLOW</span>
              <h2>事件时间线</h2>
            </div>
            <Tag bordered={false}>5 步</Tag>
          </div>

          <div className="timeline-list">
            {timelineItems.map((item, index) => (
              <div className={`timeline-item is-${item.status}`} key={item.title}>
                <div className="timeline-rail">
                  <span className="timeline-node">
                    {item.status === 'done' && <CheckCircleFilled />}
                    {item.status === 'active' && <LoadingOutlined />}
                    {item.status === 'error' && <WarningFilled />}
                    {item.status === 'pending' && index + 1}
                  </span>
                </div>
                <div className="timeline-copy">
                  <time>{item.time}</time>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="context-card">
            <span className="panel-kicker">运行上下文</span>
            <dl>
              <div><dt>机器人</dt><dd>{currentRun.robot}</dd></div>
              <div><dt>任务</dt><dd>warehouse_nav_042</dd></div>
              <div><dt>触发时间</dt><dd>{currentRun.trigger_time}</dd></div>
              <div><dt>ROS Domain</dt><dd>42</dd></div>
            </dl>
          </div>
        </aside>

        <main className="workspace-panel evidence-panel">
          <div className="panel-heading evidence-heading">
            <div>
              <span className="panel-kicker">EVIDENCE CHAIN</span>
              <h2>推理证据</h2>
            </div>
            <div className="evidence-count">
              <strong>{evidenceItems.length}</strong>
              <span>条有效证据</span>
            </div>
          </div>

          <div className="conclusion-card">
            <div className="conclusion-header">
              <div>
                <span className="panel-kicker">CURRENT CONCLUSION</span>
                <h2>当前结论</h2>
              </div>
              <Tag color="success" icon={<CheckCircleFilled />}>证据充分</Tag>
            </div>
            <div className="conclusion-grid">
              <div>
                <span>事实</span>
                <p>{currentRun.conclusion.fact}</p>
              </div>
              <div>
                <span>推理</span>
                <p>{currentRun.conclusion.reasoning}</p>
              </div>
              <div className="suggestion">
                <span>建议</span>
                <p>{currentRun.conclusion.suggestion}</p>
              </div>
            </div>
          </div>

          <div className="evidence-list">
            {evidenceItems.map((evidence) => (
              <article className="evidence-card" key={evidence.id}>
                <div className={`evidence-icon tone-${evidence.tone}`}>{evidence.icon}</div>
                <div className="evidence-body">
                  <div className="evidence-meta">
                    <Tag color={evidence.tone}>{evidence.id}</Tag>
                    <strong>{evidence.type}</strong>
                    <span>{evidence.source}</span>
                    <time>{evidence.time}</time>
                  </div>
                  <Typography.Text code className="evidence-code">
                    {evidence.content}
                  </Typography.Text>
                  <p>{evidence.detail}</p>
                </div>
                <div className="confidence">
                  <strong>{evidence.confidence}%</strong>
                  <span>置信度</span>
                </div>
              </article>
            ))}
          </div>
        </main>

        <aside className="workspace-panel chat-panel">
          <div className="panel-heading chat-heading">
            <div className="ai-title">
              <Avatar icon={<RobotOutlined />} className="ai-avatar" />
              <div>
                <h2>AI Chat</h2>
                <span><i /> 基于当前证据回答</span>
              </div>
            </div>
            <Tag bordered={false}>上下文已同步</Tag>
          </div>

          <div className="chat-context">
            <RobotOutlined />
            <span>已载入 {evidenceItems.length} 条证据和完整事件时间线</span>
          </div>

          <div className="message-list">
            {chatHistory.map((message, index) => (
              <div className={`message-row ${message.role}`} key={`${message.role}-${index}`}>
                {message.role === 'ai' && <Avatar size={28} icon={<RobotOutlined />} />}
                <div className="message-bubble">{message.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="message-row ai">
                <Avatar size={28} icon={<RobotOutlined />} />
                <div className="message-bubble typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <div className="quick-questions">
            {['为什么判定为 costmap 延迟？', '如何验证修改是否有效？'].map((question) => (
              <button key={question} type="button" onClick={() => setInputValue(question)}>
                {question}
              </button>
            ))}
          </div>

          <div className="chat-composer">
            <TextArea
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="追问当前推理..."
              autoSize={{ minRows: 2, maxRows: 4 }}
              disabled={isLoading}
            />
            <div className="composer-footer">
              <span>Enter 发送 · Shift + Enter 换行</span>
              <Button
                type="primary"
                shape="circle"
                icon={<SendOutlined />}
                onClick={handleSend}
                disabled={isLoading || !inputValue.trim()}
              />
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
