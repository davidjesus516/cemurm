import { describe, expect, it } from 'vitest'
import {
  COMPLETION_HEADLINE,
  DASHBOARD_TOUR_STEPS,
  INCOMPLETE_BANNER_TEXT,
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
})
