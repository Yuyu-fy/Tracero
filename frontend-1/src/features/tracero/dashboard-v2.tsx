import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  History,
  LayoutGrid,
  MessageSquareText,
  Search,
  Settings2,
  User,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  roleLabels,
  runs,
  stats,
  statusLabels,
  type RunStatus,
  type UserRole,
} from './mock-data'

function StatusBadge({ status }: { status: RunStatus }) {
  const classes: Record<RunStatus, string> = {
    reasoning: 'border-blue-200 bg-blue-100 text-blue-800 hover:bg-blue-200',
    done: 'border-green-200 bg-green-100 text-green-800 hover:bg-green-200',
    failed: 'border-red-200 bg-red-100 text-red-800 hover:bg-red-200',
  }
  return <Badge className={classes[status]}>{statusLabels[status]}</Badge>
}

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TraceroDashboardPage() {
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole>('general')
  const [questionOpen, setQuestionOpen] = useState(false)
  const [question, setQuestion] = useState('为什么车从这个时间点开始左右摇摆？')
  const [robot, setRobot] = useState('robot_001')
  const [occurredAt, setOccurredAt] = useState(() =>
    toLocalDateTimeInput(new Date())
  )
  const [contextWindow, setContextWindow] = useState('60')
  const recentRuns = runs.slice(0, 5)

  function handleQuestionSubmit(event: FormEvent) {
    event.preventDefault()
    const normalizedQuestion = question.trim()
    if (!normalizedQuestion || !occurredAt) return

    setQuestionOpen(false)
    void navigate({
      to: '/tracero/current',
      search: {
        question: normalizedQuestion,
        robot,
        occurred_at: new Date(occurredAt).toISOString(),
        context_window_seconds: Number(contextWindow),
      },
    })
  }

  return (
    <div className='flex h-full flex-col'>
      <Header className='px-4'>
        <div>
          <h1 className='text-xl font-semibold'>Tracero 总览</h1>
          <p className='text-sm text-muted-foreground'>
            {roleLabels[role]}视角下的机器人行为分析与故障溯源
          </p>
        </div>
        <div className='flex-1' />
        <div className='flex items-center gap-2'>
          <ThemeSwitch />
          <span className='text-sm text-muted-foreground'>视角：</span>
          <Select
            value={role}
            onValueChange={(value) => setRole(value as UserRole)}
          >
            <SelectTrigger className='w-32'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='general'>
                <LayoutGrid />
                通用
              </SelectItem>
              <SelectItem value='dev'>
                <User />
                开发
              </SelectItem>
              <SelectItem value='test'>
                <Users />
                测试
              </SelectItem>
              <SelectItem value='ops'>
                <Settings2 />
                运维
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Header>

      <Main className='space-y-6 p-6'>
        <Card className='overflow-hidden border-violet-200 bg-gradient-to-r from-violet-50 via-background to-sky-50 dark:border-violet-900 dark:from-violet-950/30 dark:to-sky-950/20'>
          <CardContent className='grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center'>
            <div className='flex gap-4'>
              <div className='flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm'>
                <MessageSquareText className='size-6' />
              </div>
              <div>
                <div className='mb-2 flex flex-wrap items-center gap-2'>
                  <h2 className='text-lg font-semibold'>
                    发起事件推理
                  </h2>
                  <Badge variant='secondary'>提前分析</Badge>
                </div>
                <p className='max-w-3xl text-sm leading-6 text-muted-foreground'>
                  不必等到碰撞、急停或任务失败。发现车辆摇摆、绕行、停顿等异常行为时，直接标记时间点并提问，系统会回溯该时刻前后的遥测、日志和控制链路进行推理。
                </p>
              </div>
            </div>
            <Dialog open={questionOpen} onOpenChange={setQuestionOpen}>
              <DialogTrigger asChild>
                <Button size='lg' className='shadow-sm'>
                  <Search />
                  提问并分析
                </Button>
              </DialogTrigger>
              <DialogContent className='sm:max-w-xl'>
                <form onSubmit={handleQuestionSubmit}>
                  <DialogHeader>
                    <DialogTitle>创建用户提问事件</DialogTitle>
                    <DialogDescription>
                      告诉系统“哪台车、什么时间、发生了什么看不懂的行为”。
                    </DialogDescription>
                  </DialogHeader>
                  <div className='grid gap-5 py-5'>
                    <div className='grid gap-2'>
                      <Label htmlFor='event-question'>你的问题</Label>
                      <Textarea
                        id='event-question'
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        placeholder='例如：14:31 左右，为什么车开始左右摇摆？'
                        className='min-h-24 resize-none'
                        autoFocus
                      />
                    </div>
                    <div className='grid gap-4 sm:grid-cols-2'>
                      <div className='grid gap-2'>
                        <Label>机器人</Label>
                        <Select value={robot} onValueChange={setRobot}>
                          <SelectTrigger className='w-full'>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value='robot_001'>robot_001</SelectItem>
                            <SelectItem value='robot_002'>robot_002</SelectItem>
                            <SelectItem value='robot_003'>robot_003</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className='grid gap-2'>
                        <Label htmlFor='occurred-at'>行为发生时间</Label>
                        <Input
                          id='occurred-at'
                          type='datetime-local'
                          value={occurredAt}
                          onChange={(event) =>
                            setOccurredAt(event.target.value)
                          }
                          required
                        />
                      </div>
                    </div>
                    <div className='grid gap-2'>
                      <Label>向前回溯范围</Label>
                      <Select
                        value={contextWindow}
                        onValueChange={setContextWindow}
                      >
                        <SelectTrigger className='w-full'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='60'>前 1 分钟</SelectItem>
                          <SelectItem value='300'>前 5 分钟</SelectItem>
                          <SelectItem value='600'>前 10 分钟</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className='text-xs text-muted-foreground'>
                        推理也会读取行为发生后的短时数据，用于判断是否继续恶化。
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => setQuestionOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      type='submit'
                      disabled={!question.trim() || !occurredAt}
                    >
                      <Search />
                      创建事件并推理
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        <div className='grid gap-4 md:grid-cols-3'>
          <StatCard
            title='推理中'
            value={stats.reasoning}
            description='正在分析事件证据链'
            icon={CircleDot}
            tone='blue'
          />
          <StatCard
            title='已完成'
            value={stats.completed}
            description='可在历史记录中回看'
            icon={CheckCircle2}
            tone='green'
          />
          <StatCard
            title='失败'
            value={stats.failed}
            description='需要补齐数据或重新触发'
            icon={AlertCircle}
            tone='red'
          />
        </div>

        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <History className='size-5' />
              <CardTitle>最近事件</CardTitle>
            </div>
            <CardDescription>
              自动告警与用户主动提问都进入同一套事件推理流程。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>机器人</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((run) => (
                  <TableRow key={run.run_id}>
                    <TableCell className='font-mono'>
                      {run.trigger_time}
                    </TableCell>
                    <TableCell>{run.event_type}</TableCell>
                    <TableCell className='max-w-[420px] whitespace-normal'>
                      {run.summary}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline' className='font-mono'>
                        {run.robot}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className='flex flex-wrap gap-3'>
          <Button asChild variant='outline'>
            <Link to='/tracero/current' search={{}}>
              <Bot />
              进入当前推理
            </Link>
          </Button>
          <Button asChild variant='outline'>
            <Link to='/tracero/history'>
              <Clock3 />
              查看历史记录
            </Link>
          </Button>
        </div>
      </Main>
    </div>
  )
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  tone,
}: {
  title: string
  value: number
  description: string
  icon: React.ElementType
  tone: 'blue' | 'green' | 'red'
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20',
    green:
      'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20',
    red: 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20',
  }
  return (
    <Card className={styles[tone]}>
      <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
        <CardTitle className='text-sm font-medium'>{title}</CardTitle>
        <Icon className='size-4' />
      </CardHeader>
      <CardContent>
        <div className='text-3xl font-bold'>{value}</div>
        <p className='text-xs text-muted-foreground'>{description}</p>
      </CardContent>
    </Card>
  )
}
