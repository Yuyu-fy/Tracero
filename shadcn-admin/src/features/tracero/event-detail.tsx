import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Code2,
  Database,
  FileText,
  Lightbulb,
  LayoutGrid,
  MessageSquareText,
  Settings2,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageInput } from '@/components/ui/message-input'
import { MessageList } from '@/components/ui/message-list'
import { ResizablePanels } from '@/components/ui/resizable-panels'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { useTraceroChatStore } from './chat-store'
import {
  DeveloperView,
  type DeveloperTab,
} from './developer/developer-view'
import {
  currentRun,
  type EvidenceType,
  type TimelineLevel,
  type UserRole,
} from './mock-data'
import { OpsView } from './ops/ops-view'
import { TestView } from './test/test-view'

const timelineStyles: Record<TimelineLevel, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300',
  critical:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300',
}

const evidenceIcons: Record<EvidenceType, React.ElementType> = {
  log: FileText,
  code: Code2,
  metric: Activity,
  config: Database,
}

const evidenceLabels: Record<EvidenceType, string> = {
  log: '日志',
  code: '代码',
  metric: '指标',
  config: '配置',
}

type EventDetailPageProps = {
  role?: UserRole
  selectedLocationId?: string
  activeDeveloperTab?: DeveloperTab
  onRoleChange?: (role: UserRole) => void
  onDeveloperLocationChange?: (locationId: string) => void
  onDeveloperTabChange?: (tab: DeveloperTab) => void
}

export function EventDetailPage({
  role: controlledRole,
  selectedLocationId,
  activeDeveloperTab: controlledDeveloperTab,
  onRoleChange,
  onDeveloperLocationChange,
  onDeveloperTabChange,
}: EventDetailPageProps = {}) {
  const navigate = useNavigate()
  const [localRole, setLocalRole] = useState<UserRole>('general')
  const [localLocationId, setLocalLocationId] = useState(
    currentRun.developerAnalysis.defaultCodeLocationId
  )
  const [localDeveloperTab, setLocalDeveloperTab] =
    useState<DeveloperTab>('code')
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const role = controlledRole ?? localRole
  const developerAnalysis = currentRun.developerAnalysis
  const activeLocationId =
    selectedLocationId ?? localLocationId
  const activeDeveloperTab = controlledDeveloperTab ?? localDeveloperTab
  const activeLocation =
    developerAnalysis.codeLocations.find(
      (location) => location.id === activeLocationId
    ) ?? developerAnalysis.codeLocations[0]
  const messages = useTraceroChatStore((state) =>
    state.getMessages(currentRun.run_id)
  )
  const addMessage = useTraceroChatStore((state) => state.addMessage)

  function changeRole(nextRole: UserRole) {
    if (onRoleChange) {
      onRoleChange(nextRole)
      return
    }

    setLocalRole(nextRole)
  }

  function changeDeveloperLocation(locationId: string) {
    if (onDeveloperLocationChange) {
      onDeveloperLocationChange(locationId)
      return
    }

    setLocalLocationId(locationId)
    setLocalDeveloperTab('code')
  }

  function changeDeveloperTab(tab: DeveloperTab) {
    if (onDeveloperTabChange) {
      onDeveloperTabChange(tab)
      return
    }

    setLocalDeveloperTab(tab)
  }

  const getRoleTitle = (r: UserRole) => {
    switch (r) {
      case 'general':
        return '通用视角'
      case 'dev':
        return '开发视角'
      case 'test':
        return '测试视角'
      case 'ops':
        return '运维视角'
    }
  }

  const handleSend = (event?: React.FormEvent) => {
    event?.preventDefault()
    if (!inputValue.trim() || isGenerating) return

    const question = inputValue.trim()

    addMessage(currentRun.run_id, {
      role: 'user',
      content: question,
      context: {
        perspective: role,
        evidenceId: role === 'dev' ? activeLocation.evidenceId : undefined,
        repository: role === 'dev' ? activeLocation.repository : undefined,
        commit: role === 'dev' ? activeLocation.commit : undefined,
        filePath: role === 'dev' ? activeLocation.filePath : undefined,
        line: role === 'dev' ? activeLocation.lineStart : undefined,
        functionName:
          role === 'dev' ? activeLocation.functionName : undefined,
        module:
          role === 'test'
            ? currentRun.testAnalysis.modules[0].module
            : undefined,
        testCaseId:
          role === 'test'
            ? currentRun.testAnalysis.testCases[0].id
            : undefined,
      },
    })
    setInputValue('')
    setIsGenerating(true)

    window.setTimeout(() => {
      addMessage(currentRun.run_id, {
        role: 'assistant',
        content:
          role === 'dev'
            ? `结合 ${activeLocation.filePath}:${activeLocation.lineStart} 的代码上下文，我会继续沿当前证据链分析。这里应优先验证地图时间戳，并检查 ${activeLocation.functionName ?? activeLocation.module} 对过期 Costmap 的处理。`
            : '我会继续沿着当前证据链分析，并根据当前视角整理下一步建议。',
        context: {
          perspective: role,
          evidenceId: role === 'dev' ? activeLocation.evidenceId : undefined,
          repository: role === 'dev' ? activeLocation.repository : undefined,
          commit: role === 'dev' ? activeLocation.commit : undefined,
          filePath: role === 'dev' ? activeLocation.filePath : undefined,
          line: role === 'dev' ? activeLocation.lineStart : undefined,
          functionName:
            role === 'dev' ? activeLocation.functionName : undefined,
          module:
            role === 'test'
              ? currentRun.testAnalysis.modules[0].module
              : undefined,
          testCaseId:
            role === 'test'
              ? currentRun.testAnalysis.testCases[0].id
              : undefined,
        },
      })
      setIsGenerating(false)
    }, 500)
  }

  return (
    <div className='flex h-full min-h-0 flex-col overflow-hidden'>
      <Header className='min-h-16 shrink-0 gap-3 px-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <Button
            variant='ghost'
            size='icon'
            onClick={() => navigate({ to: '/tracero' })}
            aria-label='返回推理总览'
          >
            <ChevronLeft className='size-5' />
          </Button>
          <div className='min-w-0'>
            <h1 className='truncate text-lg font-semibold sm:text-xl'>
              当前推理 - {currentRun.event_type}
            </h1>
            <p className='truncate text-sm text-muted-foreground'>
              {currentRun.robot} · {currentRun.trigger_time} ·{' '}
              {getRoleTitle(role)}
            </p>
          </div>
        </div>

        <div className='flex-1' />

        <div className='flex items-center gap-2'>
          <span className='hidden text-sm text-muted-foreground sm:inline'>
            视角：
          </span>
          <Select value={role} onValueChange={(v) => changeRole(v as UserRole)}>
            <SelectTrigger className='w-28 sm:w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='general'>
                <div className='flex items-center gap-2'>
                  <LayoutGrid className='size-4' />
                  <span>通用</span>
                </div>
              </SelectItem>
              <SelectItem value='dev'>
                <div className='flex items-center gap-2'>
                  <User className='size-4' />
                  <span>开发</span>
                </div>
              </SelectItem>
              <SelectItem value='test'>
                <div className='flex items-center gap-2'>
                  <Users className='size-4' />
                  <span>测试</span>
                </div>
              </SelectItem>
              <SelectItem value='ops'>
                <div className='flex items-center gap-2'>
                  <Settings2 className='size-4' />
                  <span>运维</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Header>

      <Main
        fixed
        fluid
        className='min-h-0 flex-1 overflow-hidden bg-muted/20 p-4 md:p-5'
      >
        <ResizablePanels
          left={
            <Card className='flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/90 py-0 shadow-none'>
              <CardHeader className='shrink-0 border-b py-4'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Clock3 className='size-5 text-sky-600 dark:text-sky-300' />
                  时间线
                </CardTitle>
              </CardHeader>
              <CardContent className='min-h-0 flex-1 overflow-hidden p-0'>
                <ScrollArea className='h-full'>
                  <div className='space-y-1 p-4'>
                    {currentRun.timeline.map((item, index) => (
                      <div
                        key={`${item.time}-${item.title}`}
                        className='flex gap-3'
                      >
                        <div className='flex w-16 shrink-0 flex-col items-end'>
                          <span className='font-mono text-[11px] text-muted-foreground'>
                            {item.time}
                          </span>
                          {index < currentRun.timeline.length - 1 && (
                            <span className='mt-2 h-full min-h-10 w-px bg-border' />
                          )}
                        </div>
                        <div className='min-w-0 flex-1 pb-5'>
                          <div
                            className={`mb-2 inline-flex size-7 items-center justify-center rounded-full border ${timelineStyles[item.level]}`}
                          >
                            {item.level === 'critical' ? (
                              <AlertTriangle className='size-4' />
                            ) : item.level === 'success' ? (
                              <CheckCircle2 className='size-4' />
                            ) : (
                              <Activity className='size-4' />
                            )}
                          </div>
                          <h2 className='text-sm leading-5 font-medium'>
                            {item.title}
                          </h2>
                          <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                            {item.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          }
          middle={
              <Card className='flex h-full min-h-0 min-w-0 max-w-full flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 py-0 shadow-none'>
                {role === 'dev' ? (
                  <CardContent className='min-h-0 min-w-0 flex-1 overflow-hidden p-0'>
                    <DeveloperView
                      analysis={developerAnalysis}
                      conclusion={currentRun.conclusion}
                      selectedLocationId={activeLocation.id}
                      activeTab={activeDeveloperTab}
                      onSelectLocation={changeDeveloperLocation}
                      onTabChange={changeDeveloperTab}
                    />
                  </CardContent>
                ) : role === 'test' ? (
                  <CardContent className='min-h-0 min-w-0 flex-1 overflow-hidden p-0'>
                    <TestView analysis={currentRun.testAnalysis} />
                  </CardContent>
                ) : role === 'ops' ? (
                  <CardContent className='min-h-0 min-w-0 flex-1 overflow-hidden p-0'>
                    <OpsView analysis={currentRun.opsAnalysis} />
                  </CardContent>
                ) : (
                <>
                  <CardHeader className='shrink-0 border-b py-4'>
                    <CardTitle className='flex items-center gap-2 text-base'>
                      <Sparkles className='size-5 text-amber-600 dark:text-amber-300' />
                      推理证据
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='min-h-0 flex-1 overflow-hidden p-0'>
                    <ScrollArea className='h-full'>
                      <div className='space-y-4 p-4'>
                    <section className='grid gap-3 lg:grid-cols-3'>
                      <div className='rounded-lg border border-sky-200/80 bg-sky-50/70 p-3 dark:border-sky-900/70 dark:bg-sky-950/25'>
                        <div className='mb-2 flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-sky-300'>
                          <Sparkles className='size-4' />
                          事实
                        </div>
                        <p className='text-sm leading-6'>
                          {currentRun.conclusion.fact}
                        </p>
                      </div>
                      <div className='rounded-lg border border-amber-200/80 bg-amber-50/70 p-3 dark:border-amber-900/70 dark:bg-amber-950/25'>
                        <div className='mb-2 flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-300'>
                          <Bot className='size-4' />
                          推理
                        </div>
                        <p className='text-sm leading-6'>
                          {currentRun.conclusion.reasoning}
                        </p>
                      </div>
                      <div className='rounded-lg border border-emerald-200/80 bg-emerald-50/70 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/25'>
                        <div className='mb-2 flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300'>
                          <Lightbulb className='size-4' />
                          建议
                        </div>
                        <p className='text-sm leading-6'>
                          {currentRun.conclusion.suggestion}
                        </p>
                      </div>
                    </section>

                    <section className='space-y-3'>
                      {currentRun.evidence.map((evidence) => {
                        const Icon = evidenceIcons[evidence.type]

                        return (
                          <article
                            key={evidence.id}
                            className='rounded-lg border bg-card p-4 shadow-xs'
                          >
                            <div className='flex flex-wrap items-start justify-between gap-3'>
                              <div className='flex min-w-0 items-start gap-3'>
                                <div className='flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted'>
                                  <Icon className='size-4 text-muted-foreground' />
                                </div>
                                <div className='min-w-0'>
                                  <div className='flex flex-wrap items-center gap-2'>
                                    <Badge variant='secondary'>
                                      {evidence.id}
                                    </Badge>
                                    <Badge variant='outline'>
                                      {evidenceLabels[evidence.type]}
                                    </Badge>
                                  </div>
                                  <h2 className='mt-2 text-sm leading-5 font-semibold'>
                                    {evidence.title}
                                  </h2>
                                </div>
                              </div>
                              <span className='max-w-full truncate font-mono text-xs text-muted-foreground'>
                                {evidence.source}
                              </span>
                            </div>
                            <div className='mt-3 rounded-md border bg-muted/45 px-3 py-2 font-mono text-xs leading-5 text-muted-foreground'>
                              {evidence.excerpt}
                            </div>
                            <p className='mt-3 text-sm leading-6'>
                              {evidence.impact}
                            </p>
                          </article>
                        )
                      })}
                    </section>
                  </div>
                    </ScrollArea>
                  </CardContent>
                </>
              )}
            </Card>
          }
          right={
            <Card className='flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 py-0 shadow-none'>
              <CardHeader className='flex h-14 shrink-0 items-center border-b py-0 !pb-0'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <MessageSquareText className='size-5 text-emerald-600 dark:text-emerald-300' />
                  AI Chat
                </CardTitle>
              </CardHeader>
              <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden p-0'>
                <ScrollArea className='min-h-0 flex-1'>
                  <div className='p-4'>
                    <MessageList messages={messages} isTyping={isGenerating} />
                  </div>
                </ScrollArea>

                <div className='shrink-0 border-t p-3'>
                  <form onSubmit={handleSend}>
                    <MessageInput
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      placeholder='追问当前推理...'
                      isGenerating={isGenerating}
                    />
                    <p className='mt-1.5 px-1 text-[10px] text-muted-foreground'>
                      Enter 发送 · Shift + Enter 换行
                    </p>
                  </form>
                </div>
              </CardContent>
            </Card>
          }
        />
      </Main>
    </div>
  )
}
