import { Card, CardHeader, CardContent } from '@/components/ui/card'
import { useEffect, useState } from 'react'

type PracticeHoursWidgetProps = {
  onStartSession?: () => void
}

export const PracticeHoursWidget: React.FC<PracticeHoursWidgetProps> = ({
  onStartSession
}) => {
  const [totalHours, setTotalHours] = useState(0)
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch practice stats from Supabase
    // const fetchStats = async () => {
    //   const { data, error } = await supabase
    //     .from('practice_sessions')
    //     .select('*')
    //     .gte('created_at', startOfMonth)
    //   if (error) throw error
    //   setTotalHours(data.reduce((sum, d) => sum + (d.duration_minutes || 0), 0) / 60)
    //   setSessionsThisMonth(data.length)
    //   setLoading(false)
    // }
    // fetchStats()
    setLoading(false)
  }, [])

  if (loading) {
    return (
      <Card className='rounded-lg border border-cem-elevated bg-cem-surface shadow-sm p-8 text-center'>
        <svg className='mx-auto mb-4 size-6 text-cem-secondary animate-spin' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
          <circle className='opacity-25' cx='12' cy='12' r='10' />
          <path className='opacity-75' fill='none' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' d='M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z' />
        </svg>
        <p className='text-cem-secondary'>Cargando estadísticas de práctica...</p>
      </Card>
    )
  }

  const trend = totalHours > 0 ? 'up' : 'neutral'
  const trendClass = trend === 'up' ? 'text-cem-amber' : 'text-cem-secondary'

  return (
    <Card className='rounded-lg border border-cem-elevated bg-cem-surface shadow-sm'>
      <CardHeader className='flex items-center gap-2 pb-2 border-b border-cem-elevated'>
        <svg className='size-4' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
          <path d='M12 2v4a10 10 0 1 0 0 20v-4H8' />
          <circle cx='12' cy='12' r='3' />
          <path d='M12 2v4l5 5' />
        </svg>
        <span className='text-sm font-medium text-cem-text'>
          Horas de práctica
        </span>
      </CardHeader>
      <CardContent className='pt-0'>
        <div className='grid grid-cols-2 gap-4 py-4'>
          <div>
            <p className='text-3xl font-bold text-cem-amber'>{totalHours.toFixed(1)}</p>
            <p className='text-xs text-cem-secondary'>horas totales</p>
          </div>
          <div>
            <p className='text-3xl font-bold text-cem-amber'>{sessionsThisMonth}</p>
            <p className='text-xs text-cem-secondary'>sesiones este mes</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className='pt-3 text-center'>
        <button
          onClick={onStartSession}
          className="w-full px-4 py-2 rounded-md text-sm font-medium text-cem-amber bg-cem-surface/50 hover:bg-cem-amber/10 transition-colors"
        >
          {totalHours > 0 ? 'Ver sesión' : 'Comienza tu primera sesión'}
        </button>
      </CardFooter>
    </Card>
  )
}