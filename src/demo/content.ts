// Static content for the template demo screens.
//
// blog, notes and tickets have no CEMURM domain yet, so they stay as visual
// demos. The template's original mock modules generated their rows with
// `chance` and served them through MSW handlers that are never started, which
// left every demo page empty. This module replaces that dead path with fixed
// in-memory content: no network, no Supabase, no dev-only dependency at
// runtime. Changes made on those screens live in React state only.
import blogImg1 from '@/assets/images/blog/blog-img1.png'
import blogImg2 from '@/assets/images/blog/blog-img2.png'
import blogImg3 from '@/assets/images/blog/blog-img3.png'
import blogImg4 from '@/assets/images/blog/blog-img4.png'
import blogImg5 from '@/assets/images/blog/blog-img5.png'
import blogImg6 from '@/assets/images/blog/blog-img6.png'
import userImg1 from '@/assets/images/profile/user-1.png'
import userImg2 from '@/assets/images/profile/user-2.png'
import userImg3 from '@/assets/images/profile/user-3.png'
import type { BlogPostType } from '@/types/apps/blog'
import type { notesType } from '@/types/apps/notes'
import type { TicketType } from '@/types/apps/ticket'

const ana = { id: 'author-ana', avatar: userImg1, name: 'Ana Torres' }
const diego = { id: 'author-diego', avatar: userImg2, name: 'Diego Ruiz' }

// Shared demo collaborators. Tickets and the create form read the same list so
// an agent keeps one avatar everywhere.
export const demoAgents = [
  { id: 'agent-ana', name: ana.name, photo: userImg1 },
  { id: 'agent-diego', name: diego.name, photo: userImg2 },
  { id: 'agent-marta', name: 'Marta Gil', photo: userImg3 },
]

export const demoBlogCategories = [
  'Music',
  'Practice',
  'Live',
  'Theory',
  'Gear',
]

export const demoBlogTags = [
  'Setlist',
  'Rehearsal',
  'Stage',
  'Practice',
  'Arrangement',
]

export const demoBlogPosts: BlogPostType[] = [
  {
    id: 1,
    title: 'The quiet craft of a setlist',
    content:
      'A setlist is not a playlist. It decides when the room breathes, when it sings and when it rests. These are the small rules we use before every show.',
    body: [
      'We open with the song the room already knows, then take one risk. The second song is the bridge: it tells the audience whether the night will be a concert or a background track.',
      'The middle is where the setlist earns its keep. Two songs in the same key can feel like one long song, so we separate them with a change of texture, a different voice or a short story.',
      'We close with the one we want them to hum on the way home. The encore is not a reward; it is the last sentence of the set.',
    ],
    quote: 'A setlist is a promise you make to the room.',
    coverImg: blogImg1,
    createdAt: new Date('2026-10-12T09:00:00Z'),
    view: 1240,
    share: 86,
    category: 'Music',
    featured: true,
    author: ana,
    published: true,
    comments: [
      {
        id: 'comment-1',
        profile: { id: 'reader-1', avatar: userImg3, name: 'Marta Gil' },
        time: new Date('2026-10-12T14:20:00Z'),
        comment:
          'The point about leaving space between two loud songs is the one I always forget.',
        replies: [
          {
            id: 'reply-1',
            profile: { id: 'author-ana-reply', avatar: userImg1, name: 'Ana Torres' },
            time: new Date('2026-10-12T15:02:00Z'),
            comment: 'That gap is where the audience actually hears the last chorus.',
            replies: [],
          },
        ],
      },
    ],
  },
  {
    id: 2,
    title: 'Rehearsal notes that actually help',
    content:
      'A page of observations is worth more than a recording nobody opens. Write down the two bars that fell apart, not the whole song.',
    body: [
      'Write the timestamp, the song and the two bars that fell apart. Leave the rest out. A note that says "the bridge was loose" is a feeling; a note that says "bridge, second bar, bass came in late" is a fix.',
      'At the next rehearsal, start with those two bars before the warm-up. If they are still loose, the problem is not memory; it is the arrangement.',
      'Give one person the job of keeping the notes. When everyone writes, nobody reads.',
    ],
    quote: 'Write down the two bars that fell apart, not the whole song.',
    coverImg: blogImg2,
    createdAt: new Date('2026-10-08T18:30:00Z'),
    view: 860,
    share: 41,
    category: 'Practice',
    featured: false,
    author: diego,
    published: true,
    comments: [],
  },
  {
    id: 3,
    title: 'Why your band needs a soundcheck checklist',
    content:
      'Every room is different and every cable is the same color. A five-line checklist saves the fifteen minutes you would spend guessing.',
    body: [
      'We check six things before we touch a fader: power, DI boxes, tuners, monitor sends, spare cables and the setlist taped to the floor. The list is short enough to finish and long enough to matter.',
      'The room will change the plan. The checklist does not remove that; it gives you a known starting point so the surprises are musical, not electrical.',
      'The last item is a photo of the stage. It is the fastest way to remember where everything went when the lights come up.',
    ],
    quote: 'The checklist is not for the gear; it is for the person setting it up.',
    coverImg: blogImg3,
    createdAt: new Date('2026-10-03T11:15:00Z'),
    view: 1530,
    share: 120,
    category: 'Live',
    featured: false,
    author: ana,
    published: true,
    comments: [],
  },
  {
    id: 4,
    title: 'Transposing on the fly without panic',
    content:
      'If the singer changes the key at the last second, you need a shape, not a chart. Practice the interval, then trust your ear.',
    body: [
      'A transposition is a distance, not a new song. Find the interval from the original key, move the shape, and keep the same function: the third, the fifth, the note that makes the chorus lift.',
      'If the singer changes key at the last second, do not rebuild the chart. Play the root of the new key, listen for the singer, and join on the next phrase. The audience hears the phrase, not your preparation.',
      'Practice the move in two keys you would never choose. The unfamiliar key is the one that teaches the shape.',
    ],
    quote: 'Practice the interval, then trust your ear.',
    coverImg: blogImg4,
    createdAt: new Date('2026-09-28T08:45:00Z'),
    view: 980,
    share: 55,
    category: 'Theory',
    featured: false,
    author: diego,
    published: true,
    comments: [],
  },
  {
    id: 5,
    title: 'A small rig for small stages',
    content:
      'Two pedals, one amp and a tuner can carry a whole night. The best rig is the one you can set up in the dark.',
    body: [
      'The small rig is a decision about what you are willing to carry after the show. One amp, two pedals and a tuner cover most rooms; the third pedal is usually a habit, not a need.',
      'Set it up in the dark once. If you can find the input, the power and the tuner without a light, the rig is ready for a stage with no time to spare.',
      'Leave one cable longer than you think you need. The stage is always wider than the diagram.',
    ],
    quote: 'The best rig is the one you can set up in the dark.',
    coverImg: blogImg5,
    createdAt: new Date('2026-09-21T16:00:00Z'),
    view: 720,
    share: 33,
    category: 'Gear',
    featured: false,
    author: ana,
    published: true,
    comments: [],
  },
  {
    id: 6,
    title: 'What we learned from thirty shows',
    content:
      'The songs that worked were not always the ones we liked most. The audience told us which ones to keep, one room at a time.',
    body: [
      'We tracked thirty shows and the pattern was uncomfortable: the songs we loved most were not always the ones the room kept. The songs that stayed were the ones with a clear beginning, one lift and a chorus that arrives before the third minute.',
      'The setlist changed more than the arrangements. We moved the new song next to the one the audience already knew, and the new one stopped being a test.',
      'The last lesson was about leaving. A short set that ends while the room is still with you is worth more than a long one that explains itself.',
    ],
    quote: 'The audience tells you which songs to keep.',
    coverImg: blogImg6,
    createdAt: new Date('2026-09-15T10:10:00Z'),
    view: 1810,
    share: 142,
    category: 'Live',
    featured: false,
    author: diego,
    published: true,
    comments: [],
  },
]

export const demoNotes: notesType[] = [
  {
    id: 1,
    title: 'Call the venue about the load-in time. They said 4 pm, but the doors open at 6.',
    datef: '2026-10-19T10:30:00Z',
    deleted: false,
  },
  {
    id: 2,
    title: 'Setlist idea: open with the slow one, then go straight into the new song.',
    datef: '2026-10-18T21:05:00Z',
    deleted: false,
  },
  {
    id: 3,
    title: 'Ask Marta if she can cover the second guitar on the 24th.',
    datef: '2026-10-17T12:40:00Z',
    deleted: false,
  },
  {
    id: 4,
    title: 'The monitor mix needs more voice and less kick on the small stage.',
    datef: '2026-10-15T19:15:00Z',
    deleted: false,
  },
]

export const demoTickets: TicketType[] = [
  {
    Id: 1,
    ticketTitle: 'Change the rehearsal room for next week',
    ticketDescription:
      'The usual room is booked. Confirm the alternate room and tell the band before Friday.',
    Status: 'Open',
    thumb: demoAgents[0].photo,
    AgentName: demoAgents[0].name,
    Date: new Date('2026-10-19T09:20:00Z'),
    deleted: false,
  },
  {
    Id: 2,
    ticketTitle: 'Missing XLR cable after the last show',
    ticketDescription:
      'One long XLR did not come back in the case. Check the venue lost and found.',
    Status: 'Pending',
    thumb: demoAgents[1].photo,
    AgentName: demoAgents[1].name,
    Date: new Date('2026-10-18T17:45:00Z'),
    deleted: false,
  },
  {
    Id: 3,
    ticketTitle: 'Publish the October setlist',
    ticketDescription:
      'The band approved the order. Share it with the collaborators and print two copies.',
    Status: 'Open',
    thumb: demoAgents[2].photo,
    AgentName: demoAgents[2].name,
    Date: new Date('2026-10-17T11:10:00Z'),
    deleted: false,
  },
  {
    Id: 4,
    ticketTitle: 'Update the stage plot',
    ticketDescription:
      'The new keyboard position changes the monitor sends. Update the plot before the next gig.',
    Status: 'Closed',
    thumb: demoAgents[0].photo,
    AgentName: demoAgents[0].name,
    Date: new Date('2026-10-14T08:30:00Z'),
    deleted: false,
  },
  {
    Id: 5,
    ticketTitle: 'Confirm the guest list with the venue',
    ticketDescription:
      'Six names were sent. Ask for confirmation and keep the list in the gig notes.',
    Status: 'Closed',
    thumb: demoAgents[1].photo,
    AgentName: demoAgents[1].name,
    Date: new Date('2026-10-11T15:05:00Z'),
    deleted: false,
  },
  {
    Id: 6,
    ticketTitle: 'Replace the broken strap',
    ticketDescription:
      'The backup strap is not safe. Order a replacement before the weekend.',
    Status: 'Pending',
    thumb: demoAgents[2].photo,
    AgentName: demoAgents[2].name,
    Date: new Date('2026-10-09T13:25:00Z'),
    deleted: false,
  },
]
