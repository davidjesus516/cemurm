import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

// A static guard against the bug that took /design down TWICE in one file.
//
// THE SHAPE OF THE BUG: a ref's `.current` holds a VALUE — an id, a cell, an
// array. Aliasing it into a local and then assigning `local.current = …` tries
// to create a property on that value. In strict mode (which every module here
// is) that throws:
//
//   Cannot create property 'current' on number '0'
//   Cannot create property 'current' on null
//
// Neither `pnpm build` nor a server render can see it: `renderToStaticMarkup`
// never runs an effect, and the failure only happens once the effect runs in a
// browser. It reached the page twice — once for the rAF handle, once for the
// hovered cell — before this check existed.
//
// WHY THIS IS A TEST AND NOT A LINT RULE: the repo's ESLint config is fixed
// (no-restricted-syntax for this shape would be a project-wide change), and a
// reviewer reading the diff gets no more signal from a lint rule than from this
// named test. What matters is that it FAILS, and says which line.

// Aliasing a ref's .current is legitimate exactly when the value inside is a
// mutable container the code then mutates in place. The one place this file
// does that is the grid offset object, and it is listed by name below.
const ALLOWED_ALIASES = {
  'backgrounds.jsx': ['gridOffset'],
}

const ALIAS = /const\s+(\w+)\s*=\s*(\w*[Rr]ef)\.current\b/g
const WRITES = /\.current\s*=/

const dir = new URL('./', import.meta.url)

describe('no component assigns .current onto an aliased ref value', () => {
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.jsx'))) {
    if (file.endsWith('.test.js') || file.endsWith('.test.jsx')) continue

    it(`${file} keeps ref aliases as containers, never as values`, () => {
      const source = readFileSync(new URL(file, dir), 'utf8')
      const allowed = ALLOWED_ALIASES[file] ?? []

      const offenders = []
      for (const match of source.matchAll(ALIAS)) {
        const [, local, ref] = match
        if (allowed.includes(local)) continue
        // The alias itself is only half the bug; it becomes one when something
        // later gives that local a .current of its own.
        const writes = new RegExp(`\\b${local}\\.current\\s*=`)
        if (writes.test(source)) offenders.push(`${local} <- ${ref}.current`)
      }
      expect(offenders).toEqual([])
    })
  }
})

// The rAF handle has its own, sharper failure mode: it must be a REF so the id
// can be cancelled, and it must never be aliased away. (Other refs ARE aliased
// legitimately — canvasRef, gridOffsetRef and the hovered cell — because those
// alias to values nothing later gives a .current of. The alias test above is
// what distinguishes them; this one only speaks about the frame handle.)
describe('requestAnimationFrame handles stay refs', () => {
  it('backgrounds.jsx never aliases the frame handle away', () => {
    const source = readFileSync(new URL('./backgrounds.jsx', dir), 'utf8')
    expect(source).toMatch(/const requestRef = useRef\(/)
    expect(source).not.toMatch(/=\s*requestRef\.current\b/)
    // Every write and cancel goes through the ref, never through a bare id.
    expect(source).toMatch(/requestRef\.current = requestAnimationFrame\(step\)/)
    expect(source).toMatch(/cancelAnimationFrame\(requestRef\.current\)/)
  })
})

// Sanity check on the guard itself: a file that really does alias-and-write has
// to be caught, or the guard is decorative.
describe('the alias guard can fail', () => {
  it('detects the exact pattern it was written for', () => {
    const local = 'hovered'
    const ref = 'hoveredRef'
    const offending = `const ${local} = ${ref}.current\n${local}.current = cell\n`
    const match = [...offending.matchAll(ALIAS)][0]
    expect(match?.[1]).toBe(local)
    expect(new RegExp(`\\b${local}\\.current\\s*=`).test(offending)).toBe(true)
    expect(WRITES.test(offending)).toBe(true)
  })
})
