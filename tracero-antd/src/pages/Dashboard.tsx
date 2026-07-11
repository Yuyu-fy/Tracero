import { Card, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { stats, runs, statusLabels } from '../mockData'

// 表格列定义
const columns: TableProps['columns'] = [
  {
    title: '时间',
    dataIndex: 'trigger_time',
    key: 'trigger_time',
    width: 120,
  },
  {
    title: '事件类型',
    dataIndex: 'event_type',
    key: 'event_type',
    width: 120,
  },
  {
    title: '机器人',
    dataIndex: 'robot',
    key: 'robot',
    width: 100,
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
    render: (status: string) => {
      let color: string
      if (status === 'reasoning') color = 'orange'
      else if (status === 'done') color = 'green'
      else color = 'red'
      return <Tag color={color}>{statusLabels[status as keyof typeof statusLabels]}</Tag>
    },
  },
]

export default function Dashboard() {
  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 20, fontWeight: 600 }}>系统总览</h2>

      {/* 三个统计卡片 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <Card
          style={{
            flex: 1,
            textAlign: 'center',
            background: '#fff7e6',
            borderColor: '#ffd591',
            boxShadow: '0 8px 24px rgba(250, 140, 22, 0.12)',
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fa8c16' }}>
            {stats.reasoning}
          </div>
          <div style={{ color: '#ad6800', marginTop: 8 }}>推理中</div>
        </Card>
        <Card
          style={{
            flex: 1,
            textAlign: 'center',
            background: '#f6ffed',
            borderColor: '#b7eb8f',
            boxShadow: '0 8px 24px rgba(82, 196, 26, 0.12)',
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#52c41a' }}>
            {stats.completed}
          </div>
          <div style={{ color: '#237804', marginTop: 8 }}>已完成</div>
        </Card>
        <Card
          style={{
            flex: 1,
            textAlign: 'center',
            background: '#fff1f0',
            borderColor: '#ffa39e',
            boxShadow: '0 8px 24px rgba(255, 77, 79, 0.12)',
          }}
        >
          <div style={{ fontSize: 32, fontWeight: 'bold', color: '#ff4d4f' }}>
            {stats.failed}
          </div>
          <div style={{ color: '#a8071a', marginTop: 8 }}>失败</div>
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
