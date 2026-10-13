import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { useEffect, useState } from 'react'

type UpcomingEventsWidgetProps = {
  onViewAll?: () => void
}

export const UpcomingEventsWidget: React.FC<UpcomingEventsWidgetProps> = ({
  onViewAll
}) => {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch upcoming events from Supabase
    // const fetchEvents = async () => {
    //   const { data, error } = await supabase
    //     .from('events')
    //     .select('*')
    //     .gt('date', new Date())
    //     .order('date', { ascending: true })
    //   if (error) throw error
    //   setEvents(data)
    //   setLoading(false)
    // }
    // fetchEvents()
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <Card className='rounded-lg border border-cem-elevated bg-cem-surface shadow-sm p-8 text-center'>
        <svg className='mx-auto mb-4 size-6 text-cem-secondary animate-spin' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
          <circle className='opacity-25' cx='12' cy='12' r='10' />
          <path className='opacity-75' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' d='M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z' />
        </svg>
        <p className='text-cem-secondary'>Cargando próximos eventos...</p>
      </Card>
    )
  }

  const hasEvents = events.length > 0

  return (
    <Card className='rounded-lg border border-cem-elevated bg-cem-surface shadow-sm'>
      <CardHeader className='flex items-center gap-2 pb-2 border-b border-cem-elevated'>
        <svg className='size-4' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
          <path d='M8 4h8l2-3L12 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l-2 3L4 4z' />
        </svg>
        <span className='text-sm font-medium text-cem-text'>
          Próximos eventos
        </span>
      </CardHeader>
      <CardContent className='pt-0'>
        {hasEvents && events.length > 0 ? (
          <ul className='divide-y divide-cem-elevated space-y-3'>
            {events.slice(0, 3).map((event) => (
              <li key={event.id} className='flex items-start gap-3 px-3 py-2'>
                <div className='flex-shrink-0 size-4 rounded bg-cem-surface/50 flex items-center justify-center'>
                  <svg className='size-3 text-cem-amber' viewBox='0 0 24 24' fill='currentColor'>
                    <path d='M8 4h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm8-2A2 2 0 0 0 9 6v2m0 4A2 2 0 0 0 9 10v2m-4-6v14' />
                  </svg>
                </div>
                <div className='flex-1 min-w-0'>
                  <p className='text-sm font-medium text-cem-text truncate'>{event.title}</p>
                  <p className='text-xs text-cem-secondary'>
                    {event.date} · {event.venue || 'Lugar por definir'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-xs text-cem-secondary py-4'>
            No hay eventos programados. ¡Creá el primero!
          </p>
        )}
      </CardContent>
    </Card>
  )
}