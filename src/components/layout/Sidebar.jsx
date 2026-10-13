import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { 
  UsersIcon, 
  MusicNoteIcon, 
  CalendarIcon, 
  GuitarPickupIcon,
  SettingsIcon,
  LogOutIcon 
} from 'lucide-react'

export const Sidebar = ({ organization }: { organization?: any }) => {
  const [open, setOpen] = useState(false)

  const menuItems = [
    {
      label: 'Repertorio',
      href: '/songs',
      icon: MusicNoteIcon,
    },
    {
      label: 'Setlists',
      href: '/setlists',
      icon: CalendarIcon,
    },
    {
      label: 'Eventos',
      href: '/events',
      icon: CalendarX2Icon,
    },
    {
      label: 'Inventario',
      href: '/inventory',
      icon: SquareIcon,
    },
  ]

  return (
    <SidebarProvider>
      <Sidebar className='border-r border-cem-elevated'>
        <SidebarContent className='p-4'>
          <div className='flex items-center gap-3 mb-6'>
            <SidebarTrigger className='[&_svg]:size-5!' />
            <h2 className='text-xl font-bold text-cem-text'>
              CEMURM
            </h2>
          </div>

          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item, index) => (
                  <SidebarMenuItem key={index}>
                    <SidebarMenuButton component={NavLink} to={item.href}>
                      <item.icon className='size-4' />
                      <span className='ml-2'>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {organization && (
            <SidebarGroup>
              <SidebarGroupLabel className='text-xs text-cem-secondary uppercase tracking-wider mb-2'>
                Organización
              </SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <UsersIcon className='size-3 ml-2' />
                    <span className='ml-2'>Mi perfil</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <SettingsIcon className='size-3 ml-2' />
                    <span className='ml-2'>Configuración</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => {}>Cerrar sesión</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          )}

          <SidebarGroup>
            <SidebarGroupLabel className='text-xs text-cem-secondary uppercase tracking-wider mb-2'>
              Más
            </SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton>
                  <MessageCircleIcon className='size-3 ml-2' />
                  <span className='ml-2'>Mensajes</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  )
}

// Iconos que necesitamos importar o definir
import { SquareIcon } from 'lucide-react'