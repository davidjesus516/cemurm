import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useOrganizations } from '@/hooks/useOrganizations'

export const DashboardHeader = () => {
  const { user } = useAuth()
  const [organization, setOrganization] = useState(null)

  useEffect(() => {
    // Cargar organización del usuario
    // const loadOrg = async () => {
    //   const { data: org, error } = await supabase
    //     .from('organizations')
    //     .select('*')
    //     .eq('owner_id', user.id)
    //   if (error) throw error
    //   setOrganization(org?.[0])
    // }
    // loadOrg()
    setOrganization({ name: 'CEMURM Demo', role: 'owner' })
  }, [user])

  return (
    <header className='bg-cem-surface border-b border-cem-elevated'>
      <div className='mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <NavLink to="/" className="flex items-center gap-2">
              <svg className='size-5 text-cem-amber' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M12 2L2 7l10 5 10-5-10-5z' />
                <path d='M2 7l10 5 10-5' />
              </svg>
              <span className='text-xl font-bold text-cem-text'>CEMURM</span>
            </NavLink>
          </div>

          {organization && (
            <div className='flex items-center gap-3'>
              <Avatar
                size={32}
                className='rounded-full'
                image={organization.logoUrl}
                fallback={organization.name.substring(0, 2).toUpperCase()}
              />
              <span className='text-sm font-medium text-cem-text'>
                {organization.name}
              </span>
            </div>
          )}

          <div className='flex items-center gap-2'>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Configuración"
            >
              <svg className='size-4' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M16.5 12a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z' />
                <path d='M14.5 3a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm-8 2C5.373 8.13 3 10.393 3 13s2.373 4.87 5 6.87 5-2.875 5-6.87S14.627 8.13 13 8 10.626 5.13 9 5.13z' />
              </svg>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notificaciones"
            >
              <svg className='size-4' viewBox='0 0 24 24' fill='currentColor'>
                <path d='M12 22c1.1 0 2.2-.1 3.3-.2s2.2-.2 3.2-.3c-.8-1.3-2-2-3-2S4 14 4 16c0 1.1.2 2.2.3 3.2c.1 1 .2 2.1.3 3.2A4.5 4.5 0 0 0 12 22z' />
                <path d='M9.59 14.59l2.18 2.18a1 1 0 0 1 1.42 0l1.66-1.66a1 1 0 0 1 .71-.29l2.51 1.25a2 2 0 0 1 1.19.77l2.75-2.2a2 2 0 0 0-.59-1.41L12 10.83l-3.35 1.62a2 2 0 0 1-.59-1.41l2.75-2.2a1 1 0 0 1 .71-.29l1.66 1.66l2.18-2.18a1 1 0 0 1 0-1.42L12 9.59z' />
                <path d='M12 2L2 12l10 5 10-5-10-5z' />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}