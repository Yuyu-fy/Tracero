import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Lightbulb,
  Loader2,
  MessageSquareText,
  PlayCircle,
  Sparkles,
  Timer,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTracero } from '@/context/use-tracero'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageInput } from '@/components/ui/message-input'
import { MessageList } from '@/components/ui/message-list'
import { ResizablePanels } from '@/components/ui/resizable-panels'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { sendChatMessage } from './api'
import { useTraceroChatStore } from './chat-store'
import { currentRun, type TimelineLevel } from './mock-data'
import type { AgentPushStatus, TraceroRun } from './types'

const timelineStyles: Record<TimelineLevel, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/35 dark:text-sky-300',
  warning:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/35 dark:text-amber-300',
  critical:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/35 dark:text-rose-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-300',
}

export function EventDetailPage() {
  const navigate = useNavigate()
  const tracero = useTracero()
  const run: TraceroRun = tracero.currentRun ?? currentRun
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const messages = useTraceroChatStore((state) => state.getMessages(run.run_id))
  const addMessage = useTraceroChatStore((state) => state.addMessage)

  async function handleSend(event?: React.FormEvent) {
    event?.preventDefault()
    const question = inputValue.trim()
    if (!question || isGenerating) return

    const history = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: 'user' as const, content: question },
    ]

    addMessage(run.run_id, {
      role: 'user',
      content: question,
      context: { perspective: 'general' },
    })
    setInputValue('')
    setChatError(null)
    setIsGenerating(true)

    try {
      const response = await sendChatMessage({
        run_id: run.run_id,
        message: question,
        history,
        context: {
          perspective: 'general',
          event_type: run.event_type,
          robot: run.robot,
        },
      })
      addMessage(run.run_id, {
        role: 'assistant',
        content: response.content,
        context: { perspective: 'general' },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'AI Chat 请求失败，请稍后重试'
      setChatError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <Header fixed>
        <div className='flex min-w-0 items-center gap-2'>
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
              当前推理 - {run.event_type}
            </h1>
            <div className='flex min-w-0 items-center gap-2'>
              <p className='truncate text-sm text-muted-foreground'>
                {run.robot} · {run.trigger_time} · {run.run_id}
              </p>
              {run.trigger_source === 'user_question' && (
                <Badge variant='secondary' className='shrink-0'>
                  <MessageSquareText /> 用户提问
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className='flex-1' />
        <ThemeSwitch />
      </Header>

      <Main
        fixed
        fluid
        className='flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-muted/20 p-4 md:p-5'
      >
        <ReasoningStatusBar
          status={tracero.pushStatus}
          latencyMs={tracero.latency?.total_ms}
          error={tracero.error}
          isRunning={tracero.isSimulating}
          onRun={tracero.simulateTc01Push}
          showManualTrigger={run.trigger_source !== 'user_question'}
        />

        {run.trigger_source === 'user_question' && run.user_question && (
          <section className='flex shrink-0 items-start gap-3 rounded-lg border border-violet-200 bg-violet-50/70 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/20'>
            <MessageSquareText className='mt-0.5 size-5 shrink-0 text-violet-600' />
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-2 text-sm font-medium'>
                用户想知道：{run.user_question}
                {run.context_window_seconds && (
                  <Badge variant='outline'>
                    回溯 {run.context_window_seconds / 60} 分钟
                  </Badge>
                )}
              </div>
              <p className='mt-1 text-xs text-muted-foreground'>
                这是观察事件，不要求先出现碰撞、急停或任务失败。
              </p>
            </div>
          </section>
        )}

        <div className='min-h-0 flex-1 overflow-hidden'>
          <ResizablePanels
            left={
              <Card className='flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/90 py-0 shadow-none'>
                <CardHeader className='shrink-0 border-b py-4'>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <Clock3 className='size-5 text-sky-600 dark:text-sky-300' />
                    推理过程
                  </CardTitle>
                </CardHeader>
                <CardContent className='min-h-0 flex-1 overflow-hidden p-0'>
                  <ScrollArea className='h-full'>
                    <div className='space-y-1 p-4'>
                      {run.timeline.map((item, index) => (
                        <div
                          key={`${item.time}-${item.title}`}
                          className='flex gap-3'
                        >
                          <div className='flex w-16 shrink-0 flex-col items-end'>
                            <span className='font-mono text-[11px] text-muted-foreground'>
                              {item.time}
                            </span>
                            {index < run.timeline.length - 1 && (
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
              <Card className='flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 py-0 shadow-none'>
                <CardHeader className='shrink-0 border-b py-4'>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <Sparkles className='size-5 text-violet-600 dark:text-violet-300' />
                    推理结果
                  </CardTitle>
                </CardHeader>
                <CardContent className='min-h-0 flex-1 overflow-hidden p-0'>
                  <ScrollArea className='h-full'>
                    <div className='space-y-4 p-4'>
                      <ResultCard
                        icon={Activity}
                        title='事实'
                        content={run.conclusion.fact}
                        className='border-sky-200 bg-sky-50/70 dark:border-sky-900/70 dark:bg-sky-950/25'
                      />
                      <ResultCard
                        icon={Bot}
                        title='推理'
                        content={run.conclusion.reasoning}
                        className='border-amber-200 bg-amber-50/70 dark:border-amber-900/70 dark:bg-amber-950/25'
                      />
                      <ResultCard
                        icon={Lightbulb}
                        title='建议'
                        content={run.conclusion.suggestion}
                        className='border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/70 dark:bg-emerald-950/25'
                      />
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            }
            right={
              <Card className='flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-background/95 py-0 shadow-none'>
                <CardHeader className='shrink-0 border-b py-4'>
                  <CardTitle className='flex items-center gap-2 text-base'>
                    <MessageSquareText className='size-5 text-emerald-600 dark:text-emerald-300' />
                    AI Chat
                  </CardTitle>
                </CardHeader>
                <CardContent className='flex min-h-0 flex-1 flex-col overflow-hidden p-0'>
                  <ScrollArea className='min-h-0 flex-1'>
                    <div className='p-4'>
                      <MessageList
                        messages={messages}
                        isTyping={isGenerating}
                      />
                    </div>
                  </ScrollArea>
                  <div className='shrink-0 border-t p-3'>
                    {chatError && (
                      <p className='mb-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive'>
                        {chatError}
                      </p>
                    )}
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
        </div>
      </Main>
    </div>
  )
}

function ResultCard({
  icon: Icon,
  title,
  content,
  className,
}: {
  icon: React.ElementType
  title: string
  content: string
  className: string
}) {
  return (
    <section className={cn('rounded-lg border p-4', className)}>
      <div className='mb-3 flex items-center gap-2 text-sm font-semibold'>
        <Icon className='size-4' />
        {title}
      </div>
      <p className='text-sm leading-7'>{content}</p>
    </section>
  )
}

function ReasoningStatusBar({
  status,
  latencyMs,
  error,
  isRunning,
  onRun,
  showManualTrigger,
}: {
  status: AgentPushStatus
  latencyMs?: number
  error: string | null
  isRunning: boolean
  onRun: () => Promise<void>
  showManualTrigger: boolean
}) {
  const labels: Record<AgentPushStatus, string> = {
    idle: '链路就绪',
    receiving: '正在接收事件',
    reasoning: '后端推理中',
    done: '推理完成',
    failed: '链路异常',
  }
  const descriptions: Record<AgentPushStatus, string> = {
    idle: '可手动发起一次推理，验证前端、后端与 AI Chat 的完整链路。',
    receiving: '事件已进入前端，正在等待后端处理。',
    reasoning: '后端正在生成推理过程与结果。',
    done: '推理过程和结果已更新，可继续通过 AI Chat 追问。',
    failed: '请求失败，请检查 API 地址、跨域配置和响应数据结构。',
  }
  const isBusy = status === 'receiving' || status === 'reasoning'

  return (
    <section
      className={cn(
        'flex shrink-0 flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-sm lg:flex-row lg:items-center',
        status === 'done' &&
          'border-violet-300 bg-violet-50/60 dark:bg-violet-950/20',
        status === 'failed' &&
          'border-rose-300 bg-rose-50/60 dark:bg-rose-950/20'
      )}
    >
      <div className='flex items-center gap-3'>
        <div className='flex size-11 shrink-0 items-center justify-center rounded-full border bg-background'>
          {isBusy ? (
            <Loader2 className='size-5 animate-spin text-violet-600' />
          ) : status === 'done' ? (
            <CheckCircle2 className='size-5 text-emerald-600' />
          ) : (
            <Timer className='size-5 text-violet-600' />
          )}
        </div>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h2 className='font-semibold'>{labels[status]}</h2>
            {latencyMs !== undefined && (
              <Badge variant='secondary' className='font-mono'>
                E2E {latencyMs}ms
              </Badge>
            )}
          </div>
          <p className='mt-0.5 text-sm text-muted-foreground'>
            {descriptions[status]}
          </p>
          {error && <p className='mt-1 text-xs text-destructive'>{error}</p>}
        </div>
      </div>
      {showManualTrigger && (
        <Button
          type='button'
          size='sm'
          className='lg:ml-auto'
          disabled={isRunning}
          onClick={() => void onRun()}
        >
          {isRunning ? <Loader2 className='animate-spin' /> : <PlayCircle />}
          发起推理
        </Button>
      )}
    </section>
  )
}
