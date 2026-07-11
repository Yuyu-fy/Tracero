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
import type { UserRole } from './mockData'

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
  const [role, setRole] = useState<UserRole>('dev')

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
