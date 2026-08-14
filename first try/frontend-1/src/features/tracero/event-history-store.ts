import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { mockRuns, type RunStatus } from './mock-data'
import type {
  EventTriggerSource,
  QuestionReasoningRequest,
  TraceroRun,
} from './types'

export type EventHistoryRecord = {
  run_id: string
  event_type: string
  trigger_time: string
  event_time_iso?: string
  status: RunStatus
  summary: string
  robot: string
  trigger_source: EventTriggerSource
}

type EventHistoryState = {
  records: EventHistoryRecord[]
  upsertRecord: (record: EventHistoryRecord) => void
  upsertRun: (
    run: TraceroRun,
    options?: {
      eventTimeIso?: string
      previousRunId?: string
      summary?: string
    }
  ) => void
}

const initialRecords: EventHistoryRecord[] = mockRuns.map((run) => ({
  ...run,
  trigger_source: 'automatic',
}))

export function dedupeEventHistory(records: EventHistoryRecord[]) {
  const seenQuestions = new Set<string>()

  return records.filter((record) => {
    if (record.trigger_source !== 'user_question') return true

    const question = record.summary.trim()
    if (seenQuestions.has(question)) return false

    seenQuestions.add(question)
    return true
  })
}

export const useEventHistoryStore = create<EventHistoryState>()(
  persist(
    (set) => ({
      records: initialRecords,
      upsertRecord: (record) =>
        set((state) => ({
          records: dedupeEventHistory([
            record,
            ...state.records.filter((item) => item.run_id !== record.run_id),
          ]),
        })),
      upsertRun: (run, options) =>
        set((state) => {
          const record: EventHistoryRecord = {
            run_id: run.run_id,
            event_type: run.event_type,
            trigger_time: run.trigger_time,
            event_time_iso: options?.eventTimeIso,
            status: run.status,
            summary:
              options?.summary ??
                run.user_question ??
                run.conclusion?.fact ??
                run.errors?.join('；') ??
                '推理结论未通过校验',
            robot: run.robot,
            trigger_source: run.trigger_source ?? 'automatic',
          }

          return {
            records: dedupeEventHistory([
              record,
              ...state.records.filter(
                (item) =>
                  item.run_id !== run.run_id &&
                  item.run_id !== options?.previousRunId
              ),
            ]),
          }
        }),
    }),
    {
      name: 'tracero-event-history',
      storage: createJSONStorage(() => localStorage),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<EventHistoryState>

        return {
          ...currentState,
          ...persisted,
          records: dedupeEventHistory(
            persisted.records ?? currentState.records
          ),
        }
      },
    }
  )
)

export function questionHistoryRunId(request: QuestionReasoningRequest) {
  return `run_question_pending_${request.robot}_${new Date(request.occurred_at).getTime()}`
}

export function questionHistoryRecord(
  request: QuestionReasoningRequest
): EventHistoryRecord {
  const occurredAt = new Date(request.occurred_at)
  const triggerTime = Number.isNaN(occurredAt.getTime())
    ? request.occurred_at
    : new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(occurredAt)

  return {
    run_id: questionHistoryRunId(request),
    event_type: '用户提问事件',
    trigger_time: triggerTime,
    event_time_iso: request.occurred_at,
    status: 'reasoning',
    summary: request.question,
    robot: request.robot,
    trigger_source: 'user_question',
  }
}

export const eventSourceLabels: Record<EventTriggerSource, string> = {
  automatic: '自动告警',
  user_question: '用户提问',
}
