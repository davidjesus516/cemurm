import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Admin template (shadcn-dashboard) U2/S2: the template's sources resolve
  // modules through literal path aliases ("@/..." and "src/..."). Both point
  // to this repo's own src/, so no file moved. Minimal diff, deliberate.
  resolve: {
    alias: {
      '@': path.resolve('src'),
      src: path.resolve('src'),
    },
  },

  build: {
    rollupOptions: {
      output: {
        // L5 — chunking. Three manual chunks and nothing else automatic.
        //
        // WHY EACH ONE EXISTS, measured rather than guessed (plan section 7.7):
        //
        //  `vendor`   React + ReactDOM + the router. It changes on dependency
        //              bumps and never on our own commits, so it is the one chunk
        //              a returning visitor's cache is actually useful for. It is
        //              also what every route needs, so isolating it makes the
        //              per-route arithmetic in odd/tasks/landing-page.md
        //              measurable instead of approximate.
        //
        //  `motion`   Plan section 7.3 budgets motion for the LANDING CHUNK
        //              ONLY, and visual-system hard rule 5 says no animation
        //              library ships in the authenticated bundle. Before L5 the
        //              app was one chunk, so every signed-in session downloaded
        //              it. Isolating it here means the router's React.lazy split
        //              does the rest: only /landing's chunk imports it, so an
        //              authenticated session at /songs does not fetch it at all.
        //
        //  `supabase` The client plus the store. Split out so its size is
        //              VISIBLE in the build log. It is still pulled eagerly by
        //              AuthProvider -> data/repositories/auth.js, so it remains
        //              in the landing's first visit — see section 10 of
        //              odd/tasks/landing-page.md. Moving it behind first
        //              authenticated use is B3 in the plan's team split: a
        //              behaviour contract change owned by davidjesus516, because
        //              it moves when a missing-env throw fires.
        //
        // WHAT IS DELIBERATELY NOT HERE: no chunk for `lucide-react`, `motion`
        // is the only animation library, and letting Rollup place everything
        // else automatically is what produced the 295 kB single chunk L5 exists
        // to break up. Feature code is split by React.lazy in src/app/router.jsx
        // instead, which is per-ROUTE rather than per-library — a directory of
        // small chunks would be strictly worse.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/motion') || id.includes('/framer-motion')) return 'motion'
          if (id.includes('/@supabase/') || id.includes('/@realtime')) return 'supabase'
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
            return 'vendor'
          }
          return undefined
        },
      },
    },
    // Vite's default warning is 500 kB RAW. Plan section 7.7 budgets 150 kB
    // GZIP for the largest single chunk, and the two are not the same unit —
    // gzip sits at roughly 3.5:1 on this code, so the 150 kB gzip ceiling is
    // about 500 kB raw. Leaving the default would therefore warn at almost
    // exactly the budget's raw equivalent and no further, which is defensible;
    // dropping it to 150 makes the gate STRICTER than the budget (a 150 kB raw
    // chunk is only ~45 kB gzip) and would warn on chunks that are comfortably
    // inside the real ceiling.
    //
    // So the default is left alone deliberately: it is already the honest
    // number, and this comment records that it was considered rather than
    // copied. If a future chunk genuinely exceeds 150 kB gzip, fix the chunk.
    chunkSizeWarningLimit: 500,
  },
})