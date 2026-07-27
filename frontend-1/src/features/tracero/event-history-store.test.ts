import { describe, expect, it } from 'vitest'
import {
  dedupeEventHistory,
  type EventHistoryRecord,
} from './event-history-store'

function questionRecord(runId: string, summary: string): EventHistoryRecord {
  return {
    run_id: runId,
    event_type: '用户提问事件',
    trigger_time: '12:00:00',
    status: 'done',
    summary,
    robot: 'robot_001',
    trigger_source: 'user_question',
  }
}

describe('dedupeEventHistory', () => {
  it('keeps only the newest record for an identical user question', () => {
    const newest = questionRecord('run-new', '为什么车辆左右摇摆？')
    const older = questionRecord('run-old', '为什么车辆左右摇摆？')

    expect(dedupeEventHistory([newest, older])).toEqual([newest])
  })

  it('does not merge different questions', () => {
    const first = questionRecord('run-1', '为什么车辆左右摇摆？')
    const second = questionRecord('run-2', '为什么车辆突然停车？')

    expect(dedupeEventHistory([first, second])).toEqual([first, second])
  })
})
