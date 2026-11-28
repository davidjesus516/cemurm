import { describe, expect, it } from 'vitest'
import {
  COMPLETION_HEADLINE,
  DASHBOARD_TOUR_STEPS,
  INCOMPLETE_BANNER_TEXT,
  ONBOARDING_CHECKLIST_LABELS,
  SETLIST_TOOLTIP_TEXT,
  WALKTHROUGH_SLIDES,
} from './content.js'

describe('onboarding copy matches the feature file verbatim', () => {
  it('has the three welcome topics in order', () => {
    expect(WALKTHROUGH_SLIDES.map((s) => s.topic)).toEqual([
      'Manage your repertoire',
      'Build setlists for gigs',
      'Collaborate with your band',
    ])
  })

  it('has the four dashboard tour elements and instructions', () => {
    expect(DASHBOARD_TOUR_STEPS.map(({ element, instruction }) => ({ element, instruction }))).toEqual([
      { element: 'Repertoire badge', instruction: 'Your song library is here' },
      { element: 'Setlist card', instruction: 'Create your first setlist' },
      { element: 'Bandmates tab', instruction: 'Invite your collaborators' },
      { element: 'Performance mode', instruction: 'Prepare for your next gig' },
    ])
  })

  it('pins the transient and completion strings exactly', () => {
    expect(SETLIST_TOOLTIP_TEXT).toBe('Tap here to build your first setlist')
    expect(INCOMPLETE_BANNER_TEXT).toBe('Complete your setup — it only takes 2 minutes')
    expect(COMPLETION_HEADLINE).toBe("You're all set!")
  })

  it('gives the tour a performance target that is a real in-app route', () => {
    const performance = DASHBOARD_TOUR_STEPS.find((s) => s.element === 'Performance mode')
    // /performance has no route; /setlists is where a musician picks a setlist
    // to perform, matching the dashboard card's own target.
    expect(performance.target).toBe('/setlists')
  })

  it('labels all four checklist steps so completion can be ticked off', () => {
    expect(ONBOARDING_CHECKLIST_LABELS).toEqual({
      accountCreated: 'Account created',
      joinedOrg: 'Joined an organization',
      instrumentSet: 'Instrument and level set',
      tourCompleted: 'Dashboard tour complete',
    })
  })
})
