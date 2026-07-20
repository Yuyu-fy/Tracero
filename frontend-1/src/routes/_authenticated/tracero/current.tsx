import { createFileRoute } from '@tanstack/react-router'
import { TraceroProvider } from '@/context/tracero-provider'
import { EventDetailPage } from '@/features/tracero/event-detail'
import type {
  DeveloperTab,
  QuestionReasoningRequest,
  UserRole,
} from '@/features/tracero/types'

type CurrentSearch = Partial<QuestionReasoningRequest> & {
  role?: UserRole
  tab?: DeveloperTab
}

export const Route = createFileRoute('/_authenticated/tracero/current')({
  validateSearch: (search: Record<string, unknown>): CurrentSearch => ({
    question: typeof search.question === 'string' ? search.question : undefined,
    robot: typeof search.robot === 'string' ? search.robot : undefined,
    occurred_at:
      typeof search.occurred_at === 'string' ? search.occurred_at : undefined,
    context_window_seconds:
      typeof search.context_window_seconds === 'number'
        ? search.context_window_seconds
        : undefined,
    role:
      search.role === 'general' ||
      search.role === 'dev' ||
      search.role === 'test' ||
      search.role === 'ops'
        ? search.role
        : undefined,
    tab:
      search.tab === 'code' ||
      search.tab === 'parameters' ||
      search.tab === 'logs' ||
      search.tab === 'runtime'
        ? search.tab
        : undefined,
  }),
  component: CurrentReasoningRoute,
})

// Route modules intentionally colocate the route definition and its component.
// eslint-disable-next-line react-refresh/only-export-components
function CurrentReasoningRoute() {
  const search = Route.useSearch()
  const questionRequest =
    search.question &&
    search.robot &&
    search.occurred_at &&
    search.context_window_seconds
      ? {
          question: search.question,
          robot: search.robot,
          occurred_at: search.occurred_at,
          context_window_seconds: search.context_window_seconds,
        }
      : undefined

  return (
    <TraceroProvider
      initialRole={search.role}
      initialDeveloperTab={search.tab}
      initialQuestionRequest={questionRequest}
    >
      <EventDetailPage />
    </TraceroProvider>
  )
}
