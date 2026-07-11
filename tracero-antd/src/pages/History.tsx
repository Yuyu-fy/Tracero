import { useMemo, useState } from 'react'
import { Button, Card, DatePicker, Empty, Select, Table, Tag } from 'antd'
import type { TableProps } from 'antd'
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { runs, statusLabels } from '../mockData'
import type { RunStatus } from '../mockData'
import './History.css'

const { RangePicker } = DatePicker

// 显示所有已结束的历史事件（done 和 failed）
const historyRuns = runs.filter((run) => run.status !== 'reasoning')
const robotOptions = [...new Set(historyRuns.map((run) => run.robot))].map((robot) => ({
  label: robot,
  value: robot,
}))

const columns: TableProps<(typeof historyRuns)[number]>['columns'] = [
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
    title: '机器人',
    dataIndex: 'robot',
    key: 'robot',
    width: 120,
    render: (robot: string) => <span className="robot-name">{robot}</span>,
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
    render: (status: RunStatus) => (
      <Tag color={status === 'done' ? 'green' : 'red'}>
        {statusLabels[status]}
      </Tag>
    ),
  },
]

function getRunDate(runId: string) {
  const datePart = runId.match(/^run_(\d{4})(\d{2})(\d{2})/)
  if (!datePart) return ''
  return `${datePart[1]}-${datePart[2]}-${datePart[3]}`
}

export default function History() {
  const [status, setStatus] = useState<RunStatus>()
  const [robot, setRobot] = useState<string>()
  const [dateRange, setDateRange] = useState<[string, string]>()
  const [datePickerKey, setDatePickerKey] = useState(0)

  const filteredRuns = useMemo(
    () =>
      historyRuns.filter((run) => {
        if (status && run.status !== status) return false
        if (robot && run.robot !== robot) return false

        if (dateRange) {
          const runDate = getRunDate(run.run_id)
          if (runDate < dateRange[0] || runDate > dateRange[1]) return false
        }

        return true
      }),
    [dateRange, robot, status],
  )

  const hasFilters = Boolean(status || robot || dateRange)

  function resetFilters() {
    setStatus(undefined)
    setRobot(undefined)
    setDateRange(undefined)
    setDatePickerKey((key) => key + 1)
  }

  return (
    <div className="history-page">
      <div className="history-title">
        <div>
          <h2>历史记录</h2>
          <p>查看并筛选已完成的推理任务</p>
        </div>
        <div className="result-count">
          共 <strong>{filteredRuns.length}</strong> 条记录
        </div>
      </div>

      <Card className="history-card">
        <div className="history-filters">
          <div className="filter-title">
            <SearchOutlined />
            <span>筛选条件</span>
          </div>

          <div className="filter-controls">
            <Select
              value={status}
              onChange={setStatus}
              allowClear
              placeholder="全部状态"
              options={[
                { label: statusLabels.done, value: 'done' },
                { label: statusLabels.failed, value: 'failed' },
              ]}
            />

            <Select
              value={robot}
              onChange={setRobot}
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="全部机器人"
              options={robotOptions}
            />

            <RangePicker
              key={datePickerKey}
              onChange={(_, dateStrings) => {
                if (dateStrings[0] && dateStrings[1]) {
                  setDateRange([dateStrings[0], dateStrings[1]])
                } else {
                  setDateRange(undefined)
                }
              }}
              format="YYYY-MM-DD"
              placeholder={['开始日期', '结束日期']}
            />

            <Button
              icon={<ReloadOutlined />}
              onClick={resetFilters}
              disabled={!hasFilters}
            >
              重置
            </Button>
          </div>
        </div>

        <Table
          columns={columns}
          dataSource={filteredRuns.map((run) => ({ ...run, key: run.run_id }))}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="没有符合筛选条件的记录"
              />
            ),
          }}
          scroll={{ x: 760 }}
        />
      </Card>
    </div>
  )
}
