import { Activity, Code2, FileText, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import type { currentRun } from '../mock-data'
import { CallChain } from './call-chain'
import { CodeViewer } from './code-viewer'

type DeveloperAnalysis = typeof currentRun.developerAnalysis
type Conclusion = typeof currentRun.conclusion
export type DeveloperTab = 'code' | 'parameters' | 'logs' | 'runtime'

type DeveloperViewProps = {
  analysis: DeveloperAnalysis
  conclusion: Conclusion
  selectedLocationId: string
  activeTab: DeveloperTab
  onSelectLocation: (locationId: string) => void
  onTabChange: (tab: DeveloperTab) => void
}

export function DeveloperView({
  analysis,
  conclusion,
  selectedLocationId,
  activeTab,
  onSelectLocation,
  onTabChange,
}: DeveloperViewProps) {
  const selectedLocation =
    analysis.codeLocations.find(
      (location) => location.id === selectedLocationId
    ) ?? analysis.codeLocations[0]

  return (
    <div className='flex h-full min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden'>
      <div className='shrink-0 border-b bg-muted/20 px-3 py-3'>
        <div className='mb-3 grid gap-2 xl:grid-cols-3'>
          <ConclusionItem
            label='事实'
            content={conclusion.fact}
            evidenceId='E-03'
            className='border-sky-200/80 bg-sky-50/70 text-sky-950'
            onClick={() => onSelectLocation('LOC-E03')}
          />
          <ConclusionItem
            label='推理'
            content={conclusion.reasoning}
            evidenceId='E-02'
            className='border-amber-200/80 bg-amber-50/70 text-amber-950'
            onClick={() => onSelectLocation('LOC-E02')}
          />
          <ConclusionItem
            label='建议'
            content={conclusion.suggestion}
            evidenceId='E-04'
            className='border-emerald-200/80 bg-emerald-50/70 text-emerald-950'
            onClick={() => onSelectLocation('LOC-E04')}
          />
        </div>
        <div className='flex flex-wrap items-start justify-between gap-2'>
          <div>
            <h2 className='text-sm font-semibold'>开发定位工作台</h2>
            <p className='mt-1 text-xs leading-5 text-muted-foreground'>
              {analysis.technicalSummary}
            </p>
          </div>
          <Badge variant='outline' className='font-mono text-[10px]'>
            {selectedLocation.evidenceId} · {selectedLocation.module}
          </Badge>
        </div>
      </div>

      <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden lg:flex-row'>
        <div className='relative z-10 flex min-h-52 min-w-0 shrink-0 flex-col overflow-hidden border-b bg-background lg:min-h-0 lg:w-[320px] lg:border-r lg:border-b-0'>
          <CallChain
            nodes={analysis.callChain}
            selectedLocationId={selectedLocation.id}
            onSelectLocation={onSelectLocation}
          />
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => onTabChange(value as DeveloperTab)}
          className='relative z-0 min-h-0 min-w-0 flex-1 gap-0 overflow-hidden [contain:inline-size] lg:w-0'
        >
          <div className='shrink-0 border-b px-3 py-2'>
            <TabsList className='grid w-full grid-cols-4'>
              <TabsTrigger value='code'>
                <Code2 />
                代码
              </TabsTrigger>
              <TabsTrigger value='parameters'>
                <Settings2 />
                参数
              </TabsTrigger>
              <TabsTrigger value='logs'>
                <FileText />
                日志
              </TabsTrigger>
              <TabsTrigger value='runtime'>
                <Activity />
                运行数据
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent
            value='code'
            className='min-h-0 min-w-0 overflow-hidden p-3'
          >
            <CodeViewer location={selectedLocation} />
          </TabsContent>

          <TabsContent value='parameters' className='min-h-0 overflow-hidden'>
            <ScrollArea className='h-full'>
              <div className='space-y-2 p-3'>
                {analysis.parameters.map((parameter) => (
                  <Button
                    key={parameter.name}
                    type='button'
                    variant='outline'
                    className='h-auto w-full justify-start p-3 text-left'
                    onClick={() => {
                      onSelectLocation(parameter.codeLocationId)
                      onTabChange('code')
                    }}
                  >
                    <span className='min-w-0 flex-1'>
                      <span className='block font-mono text-xs font-semibold'>
                        {parameter.name}
                      </span>
                      <span className='mt-1 block text-xs text-muted-foreground'>
                        当前 {parameter.value} → 建议{' '}
                        {parameter.recommendedValue}
                      </span>
                      <span className='mt-1 block truncate font-mono text-[10px] text-muted-foreground'>
                        {parameter.filePath}:{parameter.line}
                      </span>
                    </span>
                    <Badge variant='secondary'>{parameter.evidenceId}</Badge>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value='logs' className='min-h-0 overflow-hidden'>
            <ScrollArea className='h-full'>
              <div className='space-y-2 p-3'>
                {analysis.logs.map((log) => (
                  <button
                    key={`${log.time}-${log.message}`}
                    type='button'
                    className='w-full rounded-md border bg-card p-3 text-left hover:bg-muted/50'
                    onClick={() => {
                      if (log.codeLocationId) {
                        onSelectLocation(log.codeLocationId)
                        onTabChange('code')
                      }
                    }}
                  >
                    <span className='flex flex-wrap items-center gap-2'>
                      <Badge
                        variant={log.level === 'ERROR' ? 'destructive' : 'outline'}
                      >
                        {log.level}
                      </Badge>
                      <span className='font-mono text-[10px] text-muted-foreground'>
                        {log.time} · {log.source}
                      </span>
                    </span>
                    <span className='mt-2 block font-mono text-xs'>
                      {log.message}
                    </span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value='runtime' className='min-h-0 overflow-hidden'>
            <ScrollArea className='h-full'>
              <div className='grid gap-3 p-3 sm:grid-cols-2'>
                {analysis.runtimeMetrics.map((metric) => (
                  <div
                    key={metric.label}
                    className='rounded-md border bg-card p-3'
                  >
                    <p className='text-xs text-muted-foreground'>
                      {metric.label}
                    </p>
                    <div className='mt-2 flex items-end justify-between gap-2'>
                      <strong className='text-xl'>{metric.value}</strong>
                      <Badge
                        variant={
                          metric.status === 'critical'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {metric.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ConclusionItem({
  label,
  content,
  evidenceId,
  className,
  onClick,
}: {
  label: string
  content: string
  evidenceId: string
  className: string
  onClick: () => void
}) {
  return (
    <div className={`rounded-md border p-2.5 ${className}`}>
      <div className='flex items-center justify-between gap-2'>
        <strong className='text-xs'>{label}</strong>
        <button
          type='button'
          onClick={onClick}
          className='rounded border border-current/20 bg-white/45 px-1.5 py-0.5 font-mono text-[9px] hover:bg-white/80'
          title={`定位 ${evidenceId}`}
        >
          {evidenceId}
        </button>
      </div>
      <p className='mt-1.5 line-clamp-3 text-[11px] leading-5'>{content}</p>
    </div>
  )
}
