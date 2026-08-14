import { createFileRoute } from '@tanstack/react-router'
import { EventListPage } from '@/features/tracero/event-list'

export const Route = createFileRoute('/_authenticated/tracero/event/$id')({
  component: EventListPage,
})
