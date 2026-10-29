import { ArrowRight, Building2, Settings } from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp'
import { Link } from 'react-router-dom'
import {
  useAdminProfile,
  type AdminMembership,
} from '@/hooks/shared/useAdminProfile'

const ROLE_LABELS: Record<string, string> = {
  org_owner: 'Owner',
  org_admin: 'Admin',
  branch_admin: 'Branch admin',
  instructor: 'Instructor',
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-chart-2/10! text-chart-2!',
  former: 'bg-cem-hover! text-cem-secondary-elevated!',
  pending: 'bg-chart-5/10! text-chart-5!',
}

const BCrumb = [
  { to: '/dashboard', title: 'Home' },
  { title: 'Profile' },
]

function roleLabel(role: string): string {
  if (!role) return '—'
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ')
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className='text-xs text-cem-secondary'>{label}</p>
      <p className='break-words'>{value || '—'}</p>
    </div>
  )
}

function MembershipRow({ membership }: { membership: AdminMembership }) {
  return (
    <div className='flex items-start justify-between gap-4 border-b border-cem-hover py-3 last:border-b-0 last:pb-0 first:pt-0'>
      <div className='flex flex-col gap-0.5'>
        <span className='text-sm font-medium text-cem-text'>
          {membership.orgName}
        </span>
        <span className='text-xs font-normal text-cem-secondary'>
          {[membership.branchName, roleLabel(membership.role)]
            .filter(Boolean)
            .join(' · ')}
        </span>
        <span className='text-xs font-normal text-cem-secondary'>
          Joined {formatDate(membership.joinedAt)}
        </span>
      </div>
      <Badge
        className={`capitalize ${
          STATUS_STYLES[membership.status] ??
          'bg-cem-hover! text-cem-secondary-elevated!'
        }`}
      >
        {membership.status || 'unknown'}
      </Badge>
    </div>
  )
}

const UserProfile = () => {
  const profile = useAdminProfile()

  const name =
    profile.displayName ||
    profile.username ||
    profile.email ||
    (profile.loading ? 'Loading…' : 'Your profile')

  const initials = (
    profile.displayName ||
    profile.username ||
    profile.email ||
    '?'
  )
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div className='flex flex-col gap-4'>
      <BreadcrumbComp title='Profile' items={BCrumb} />

      <Card className='p-4 sm:p-6'>
        <div className='flex w-full flex-col items-center gap-6 break-words sm:flex-row'>
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=''
              width={80}
              height={80}
              className='h-20 w-20 shrink-0 rounded-full object-cover'
            />
          ) : (
            <div
              aria-hidden='true'
              className='flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-cem-amber/10 text-xl font-semibold text-cem-amber'>
              {initials}
            </div>
          )}

          <div className='flex w-full flex-wrap items-center justify-center gap-4 sm:justify-between'>
            <div className='flex flex-col gap-1.5 text-center sm:text-left'>
              <h5 className='text-lg font-semibold text-cem-text'>{name}</h5>
              <div className='flex flex-wrap items-center justify-center gap-1 sm:justify-start md:gap-3'>
                {profile.username ? (
                  <p className='text-sm text-cem-secondary'>
                    @{profile.username}
                  </p>
                ) : null}
                <div className='hidden h-4 w-px bg-cem-elevated xl:block' />
                <p className='text-sm text-cem-secondary'>
                  {roleLabel(profile.role)}
                  {profile.orgName ? ` · ${profile.orgName}` : ''}
                </p>
              </div>
            </div>

            <div className='flex items-center gap-2'>
              <Link
                to='/organizations'
                aria-label='Organizations'
                className='flex h-11 w-11 items-center justify-center rounded-full border border-cem-hover text-cem-secondary-elevated transition-colors hover:bg-cem-hover/40 hover:text-cem-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cem-secondary/50'
              >
                <Building2 width={20} height={20} />
              </Link>
              <Link
                to='/settings'
                aria-label='Settings'
                className='flex h-11 w-11 items-center justify-center rounded-full border border-cem-hover text-cem-secondary-elevated transition-colors hover:bg-cem-hover/40 hover:text-cem-text focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-cem-secondary/50'
              >
                <Settings width={20} height={20} />
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <div className='grid grid-cols-1 items-start gap-4 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6'>
              <Field label='Display Name' value={profile.displayName} />
              <Field
                label='Username'
                value={profile.username ? `@${profile.username}` : ''}
              />
              <Field label='Email' value={profile.email} />
              <Field label='Role' value={roleLabel(profile.role)} />
              <Field label='Organization' value={profile.orgName} />
              <Field
                label='Member Since'
                value={formatDate(profile.joinedAt)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            {profile.memberships.length === 0 ? (
              <p className='text-sm text-cem-secondary'>
                {profile.loading
                  ? 'Loading memberships…'
                  : 'No organization memberships.'}
              </p>
            ) : (
              <div className='flex flex-col'>
                {profile.memberships.map((membership) => (
                  <MembershipRow
                    key={membership.id}
                    membership={membership}
                  />
                ))}
              </div>
            )}
            <div className='mt-6 flex justify-end'>
              <Link
                to='/organizations'
                className={buttonVariants({ variant: 'outline' })}
              >
                View organizations
                <ArrowRight width={18} height={18} />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default UserProfile
