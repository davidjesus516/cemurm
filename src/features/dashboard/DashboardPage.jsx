import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

import { AppLayout } from '@/app/AppLayout'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuth } from '@/hooks/useAuth'
import { useOrganizations } from '@/hooks/useOrganizations'
import { usePracticeStats } from '@/hooks/usePracticeStats'
import { useUpcomingEvents } from '@/hooks/useUpcomingEvents'

import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { MostUsedSongsWidget } from '@/components/dashboard/MostUsedSongsWidget'
import { PracticeHoursWidget } from '@/components/dashboard/PracticeHoursWidget'
import { UpcomingEventsWidget } from '@/components/dashboard/UpcomingEventsWidget'

export const DashboardPage = () => {
  const { user } = useAuth()
  const [organization, setOrganization] = useState(null)
  const [mostUsedSongs, setMostUsedSongs] = useState([])
  const [practiceStats, setPracticeStats] = useState({
    totalHours: 0,
    sessionsThisMonth: 0,
    trend: 'up'
  })
  const [upcomingEvents, setUpcomingEvents] = useState([])

  useEffect(() => {
    if (user) {
      // Cargar datos del usuario y organizaciones
      // ...
    }
  }, [user])

  if (!user) {
    return (
      <AppLayout>
        <Sidebar />
        <main className='mx-auto py-8 px-4 max-w-7xl'>
          <div className='text-center'>
            <h1 className='text-3xl font-bold text-cem-text mb-2'>
              Bienvenido a CEMURM
            </h1>
            <p className='text-cem-secondary mb-8'>
              Por favor, inicia sesión para ver tu dashboard
          </div>
        </main>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Sidebar organization={organization} />
      <main className='flex-1 py-8 px-4 sm:px-6 lg:px-8'>
        <DashboardHeader />

        <section className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto'>
          {/* Widget: Most used songs */}
          <MostUsedSongsWidget
            songs={mostUsedSongs}
            onViewAll={() => {}}
          />

          {/* Widget: Practice hours */}
          <PracticeHoursWidget
            stats={practiceStats}
            onStartSession={() => {}}
          />

          {/* Widget: Upcoming events */}
          <UpcomingEventsWidget
            events={upcomingEvents}
            onViewAll={() => {}}
          />
        </section>
      </main>
    </AppLayout>
  )
}