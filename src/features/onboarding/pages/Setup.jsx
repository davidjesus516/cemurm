/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../app/providers/useAuth.jsx'
import {
  addOrgBranch,
  createOrgInvite,
  createOrganization,
  redeemInvite,
  saveInstrumentAndLevel,
} from '../../../data/repositories/onboardingInvites.js'
import { getMyOrganizations } from '../../../data/repositories/orgRepertoire.js'
import { INVITE_ERROR } from '../../../domain/onboarding/invite.js'
import { getPendingInviteCode, setPendingInviteCode } from '../localFlags.js'
import { useOnboarding } from '../useOnboarding.js'

const field =
  'w-full rounded-md border border-cem-elevated bg-cem-base px-3 py-2 text-sm text-cem-text placeholder:text-cem-secondary focus:border-cem-amber focus:outline-hidden focus:ring-2 focus:ring-cem-amber'

const ORG_TYPES = ['Academy', 'Church', 'Orchestra', 'School', 'Other']
const INSTRUMENTS = ['guitar', 'piano', 'voice', 'bass', 'drums', 'violin', 'other']
const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced']

function JoinCard({ onJoined }) {
  const [code, setCode] = useState(() => getPendingInviteCode())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const org = await redeemInvite(code)
      setPendingInviteCode('')
      await onJoined(org)
    } catch {
      setError(INVITE_ERROR)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-cem-elevated bg-cem-base p-5">
      <h3 className="text-base font-semibold text-cem-text">Join with an invite code</h3>
      <p className="mt-1 text-xs text-cem-secondary-elevated">
        Your band admin gives you a code such as ACAD-MAD-001.
      </p>
      <div className="mt-4 flex gap-2">
        <input
          aria-label="Invite code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ACAD-MAD-001"
          className={field}
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
        >
          Join
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-cem-amber">{error}</p>}
    </form>
  )
}

// The admin can mint invite codes for an org they already own/admin.
function InviteCodeCard() {
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState('')
  const [code, setCode] = useState('ACAD-MAD-001')
  const [days, setDays] = useState(7)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    getMyOrganizations()
      .then((rows) => {
        const admins = rows.filter((r) => ['org_owner', 'org_admin'].includes(r.role) && r.status === 'active')
        setOrgs(admins)
        if (admins[0]) setOrgId(admins[0].orgId)
      })
      .catch(() => setOrgs([]))
  }, [])

  async function generate(event) {
    event.preventDefault()
    setNotice('')
    if (!orgId) {
      setNotice('You need to own or administer an organization first.')
      return
    }
    try {
      await createOrgInvite({ orgId, code, role: 'org_member', expiresInDays: Number(days) })
      setNotice(`Invite code ${code} created — valid for ${days} days.`)
    } catch {
      setNotice('Could not create the invite code. Check the code is unique.')
    }
  }

  return (
    <form onSubmit={generate} className="rounded-lg border border-cem-elevated bg-cem-base p-5">
      <h3 className="text-base font-semibold text-cem-text">Invite code</h3>
      <p className="mt-1 text-xs text-cem-secondary-elevated">
        Default expiry is 7 days. Share the code with your first team member.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-cem-text">
          Organization
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={`mt-1 ${field}`}>
            {orgs.length === 0 && <option value="">No organization yet</option>}
            {orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.org?.name ?? o.orgId}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-cem-text">
          Code
          <input value={code} onChange={(e) => setCode(e.target.value)} className={`mt-1 ${field}`} />
        </label>
        <label className="block text-xs font-medium text-cem-text">
          Expires in (days)
          <input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} className={`mt-1 ${field}`} />
        </label>
      </div>
      <button
        type="submit"
        className="mt-4 rounded-md border border-cem-amber px-4 py-2 text-sm font-medium text-cem-amber hover:bg-cem-amber/10"
      >
        Generate invite code
      </button>
      {notice && <p role="status" className="mt-3 text-xs text-cem-amber">{notice}</p>}
    </form>
  )
}

function CreateOrgCard({ onCreated }) {
  const [form, setForm] = useState({ name: '', type: 'Academy', branch: '', city: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function change(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const org = await createOrganization(form)
      await onCreated(org)
    } catch {
      setError('Organization details are invalid.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-cem-elevated bg-cem-base p-5">
      <h3 className="text-base font-semibold text-cem-text">Create an organization</h3>
      <p className="mt-1 text-xs text-cem-secondary-elevated">
        Name, type and primary branch — you become the owner/admin and land on the org dashboard.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-cem-text">
          Organization name
          <input name="name" value={form.name} onChange={change} className={`mt-1 ${field}`} required />
        </label>
        <label className="block text-xs font-medium text-cem-text">
          Org type
          <select name="type" value={form.type} onChange={change} className={`mt-1 ${field}`}>
            {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-cem-text">
          Primary branch
          <input name="branch" value={form.branch} onChange={change} className={`mt-1 ${field}`} required />
        </label>
        <label className="block text-xs font-medium text-cem-text">
          Location
          <input name="city" value={form.city} onChange={change} className={`mt-1 ${field}`} />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
      >
        Create organization
      </button>
      {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
    </form>
  )
}

// Org admins add branches from setup (the existing Organizations page has no
// branch-create control). The 0051 RPC re-checks ownership server-side.
function AddBranchCard() {
  const [orgs, setOrgs] = useState([])
  const [orgId, setOrgId] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getMyOrganizations()
      .then((rows) => {
        const admins = rows.filter((r) => ['org_owner', 'org_admin'].includes(r.role) && r.status === 'active')
        setOrgs(admins)
        if (admins[0]) setOrgId(admins[0].orgId)
      })
      .catch(() => setOrgs([]))
  }, [])

  async function submit(event) {
    event.preventDefault()
    setNotice('')
    if (!orgId) {
      setNotice('You need to own or administer an organization first.')
      return
    }
    setBusy(true)
    try {
      const branch = await addOrgBranch({ orgId, name, city })
      setNotice(`Branch ${branch.branchName} added.`)
      setName('')
      setCity('')
    } catch {
      setNotice('Branch details are invalid.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-cem-elevated bg-cem-base p-5">
      <h3 className="text-base font-semibold text-cem-text">Add a branch</h3>
      <p className="mt-1 text-xs text-cem-secondary-elevated">
        Add a location such as “Sede Lima” to an org you own or administer.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-cem-text">
          Organization
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} className={`mt-1 ${field}`}>
            {orgs.length === 0 && <option value="">No organization yet</option>}
            {orgs.map((o) => <option key={o.orgId} value={o.orgId}>{o.org?.name ?? o.orgId}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-cem-text">
          Branch name
          <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${field}`} required />
        </label>
        <label className="block text-xs font-medium text-cem-text">
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} className={`mt-1 ${field}`} />
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md border border-cem-amber px-4 py-2 text-sm font-medium text-cem-amber hover:bg-cem-amber/10 disabled:opacity-60"
      >
        Add branch
      </button>
      {notice && <p role="status" className="mt-3 text-xs text-cem-amber">{notice}</p>}
    </form>
  )
}

function ProfileCard({ onDone }) {
  const { user } = useAuth()
  const [instrument, setInstrument] = useState('guitar')
  const [skillLevel, setSkillLevel] = useState('intermediate')
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (!user) return
    setBusy(true)
    try {
      await saveInstrumentAndLevel(user.id, instrument, skillLevel)
      await onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-cem-elevated bg-cem-base p-5">
      <h3 className="text-base font-semibold text-cem-text">My Profile</h3>
      <p className="mt-1 text-xs text-cem-secondary-elevated">
        We use this to recommend songs and setlists that fit you.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-cem-text">
          Primary instrument
          <select value={instrument} onChange={(e) => setInstrument(e.target.value)} className={`mt-1 ${field}`}>
            {INSTRUMENTS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-cem-text">
          Skill level
          <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} className={`mt-1 ${field}`}>
            {SKILL_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="mt-4 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base hover:bg-cem-amber/90 disabled:opacity-60"
      >
        Save profile
      </button>
    </form>
  )
}

// One setup route; the active card follows the first incomplete step so a
// returning user resumes where they left off (banner → resumeStep).
function Setup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { update, resumeStep } = useOnboarding()
  const requested = params.get('step')
  const step = requested && ['joinedOrg', 'instrumentSet', 'tourCompleted'].includes(requested)
    ? requested
    : resumeStep

  function goHome(patch) {
    return update(patch).then(() => navigate('/'))
  }

  if (step === 'instrumentSet') {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-cem-text">Set up your profile</h1>
        <p className="mt-1 text-sm text-cem-secondary">My Profile — choose your instrument and level.</p>
        <div className="mt-6"><ProfileCard onDone={() => goHome({ instrumentSet: true })} /></div>
      </div>
    )
  }

  if (step === 'tourCompleted') {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-cem-text">You are ready</h1>
        <button
          type="button"
          onClick={() => goHome({ tourCompleted: true })}
          className="mt-4 rounded-md bg-cem-amber px-4 py-2 text-sm font-medium text-cem-base"
        >
          Go to dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-cem-text">Set up your organization</h1>
      <p className="mt-1 text-sm text-cem-secondary">
        Create your own org, or join the one your band already uses.
      </p>
      <div className="mt-6 grid gap-4">
        <CreateOrgCard
          onCreated={(org) =>
            update({ joinedOrg: true, joinedOrgId: org.orgId, joinedRole: org.role }).then(() =>
              navigate('/onboarding/setup?step=instrumentSet'),
            )
          }
        />
        <AddBranchCard />
        <InviteCodeCard />
        <JoinCard
          onJoined={(org) =>
            update({ joinedOrg: true, joinedOrgId: org.orgId, joinedRole: org.role }).then(() =>
              navigate('/onboarding/setup?step=instrumentSet'),
            )
          }
        />
      </div>
    </div>
  )
}

export default Setup
