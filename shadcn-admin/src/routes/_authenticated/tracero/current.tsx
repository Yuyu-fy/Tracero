import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { EventDetailPage } from '@/features/tracero/event-detail'

export const Route = createFileRoute('/_authenticated/tracero/current')({
  validateSearch: z.object({
    role: z.enum(['general', 'dev', 'test', 'ops']).catch('general'),
    location: z.string().optional(),
    tab: z.enum(['code', 'parameters', 'logs', 'runtime']).catch('code'),
  }),
  component: CurrentRunRoute,
})

function CurrentRunRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()

  return (
    <EventDetailPage
      role={search.role}
      selectedLocationId={search.location}
      activeDeveloperTab={search.tab}
      onRoleChange={(role) =>
        navigate({
          search: (previous) => ({ ...previous, role }),
          replace: true,
        })
      }
      onDeveloperLocationChange={(location) =>
        navigate({
          search: (previous) => ({
            ...previous,
            role: 'dev',
            location,
            tab: 'code',
          }),
          replace: true,
        })
      }
      onDeveloperTabChange={(tab) =>
        navigate({
          search: (previous) => ({ ...previous, role: 'dev', tab }),
          replace: true,
        })
      }
    />
  )
}
