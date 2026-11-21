// @ts-check
// Exact user-facing copy from features/user-onboarding.feature. Quoting the
// strings once here lets a node-level test guard them verbatim — the feature
// file is the product source of truth, not a paraphrase in a component.

/** @type {ReadonlyArray<{ id: string, topic: string, body: string }>} */
export const WALKTHROUGH_SLIDES = Object.freeze([
  {
    id: 'repertoire',
    topic: 'Manage your repertoire',
    body: 'Keep every chord chart and lyric in one library, ready offline.',
  },
  {
    id: 'setlists',
    topic: 'Build setlists for gigs',
    body: 'Arrange songs into setlists and share them with your band.',
  },
  {
    id: 'collaborate',
    topic: 'Collaborate with your band',
    body: 'Invite bandmates and rehearse from the same charts.',
  },
])

/** @type {ReadonlyArray<{ step: number, element: string, instruction: string, target: string }>} */
export const DASHBOARD_TOUR_STEPS = Object.freeze([
  { step: 1, element: 'Repertoire badge', instruction: 'Your song library is here', target: '/songs' },
  { step: 2, element: 'Setlist card', instruction: 'Create your first setlist', target: '/setlists' },
  { step: 3, element: 'Bandmates tab', instruction: 'Invite your collaborators', target: '/bandmates' },
  // /performance has no route; /setlists is where a musician picks a setlist
  // to perform, matching the dashboard card's own target.
  { step: 4, element: 'Performance mode', instruction: 'Prepare for your next gig', target: '/setlists' },
])

// The version that introduced "Live Performance Mode". The feature tooltip is
// shown until it has been seen on this version; a future introduction bumps it.
export const FEATURE_TOOLTIP_VERSION = '0.1.0'

/** @type {Readonly<Record<string, string>>} */
export const ONBOARDING_CHECKLIST_LABELS = Object.freeze({
  accountCreated: 'Account created',
  joinedOrg: 'Joined an organization',
  instrumentSet: 'Instrument and level set',
  tourCompleted: 'Dashboard tour complete',
})

export const SETLIST_TOOLTIP_TEXT = 'Tap here to build your first setlist'
export const INCOMPLETE_BANNER_TEXT = 'Complete your setup — it only takes 2 minutes'
export const COMPLETION_HEADLINE = "You're all set!"
export const FEATURE_TOOLTIP_TITLE = 'Live Performance Mode'
export const FEATURE_TOOLTIP_TEXT =
  'Advance songs, switch chords and project lyrics from this screen. Tap a song to make it live.'

export const WALKTHROUGH_GET_STARTED = 'Get Started'
export const WALKTHROUGH_SKIP = 'Skip'
export const TOUR_SKIP = 'Skip Tour'
export const TOUR_REOPEN = 'Take a Tour'
