// Setlist detail — the seam the unit tier cannot see: a real browser, the real
// RLS policies, the seed's rows and the real file download.
//
// Regression pin (PR #455): the setlist repository stopped selecting
// `setlist_items.agreed_key`, so `agreedKeys` was always `{}` and every
// exported OnSong file shipped without the band's agreed key. Nothing failed,
// because no test opened a setlist page — the data factory writes
// `setlist_items` but no spec ever reads one. The download test below is the
// assertion that would have caught it, and it discriminates: the seed's two
// songs carry no key of their own (no `song_versions` row, no key column on
// `songs`), so with the regression the file has no `{key: ...}` line at all —
// not a wrong key, an absent one.

import fs from 'node:fs';

import { test, expect } from '@playwright/test';
import { loginAsDemo, loginAsIsolation, loginAsOutsider } from '../../fixtures/auth.js';
import { demoSetlistId, demoSongIds } from '../../fixtures/users.js';

const setlistPath = `/setlists/${demoSetlistId}`;
const wayMakerId = demoSongIds.wayMaker;
const oceansId = demoSongIds.oceans;

/** @param {import('@playwright/test').Page} page */
async function renderedSongIds(page) {
  return page
    .locator('[data-song-id]')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-song-id')));
}

test.describe('@setlists Setlist detail page', () => {
  test('demo sees both songs, in setlist order', async ({ page }) => {
    await loginAsDemo(page);
    await page.goto(setlistPath);

    await expect(page.getByRole('heading', { name: 'Demo Setlist' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Way Maker')).toBeVisible();
    await expect(page.getByText('Oceans (Where Feet May Fail)')).toBeVisible();

    // Order comes from `setlist_items.position`, and the page renders in that
    // order. Reading the row ids is stricter than comparing two row y
    // coordinates: two rows can legitimately share a y, and an assertion that
    // passes when both rows sit at the same height proves nothing about order.
    expect(await renderedSongIds(page)).toEqual([wayMakerId, oceansId]);
  });

  test("the download carries the band's agreed keys", async ({ page }) => {
    await loginAsDemo(page);
    await page.goto(setlistPath);

    const downloadButton = page.getByRole('button', { name: 'Download' });
    await expect(downloadButton).toBeVisible({ timeout: 15_000 });

    // The format menu defaults to OnSong (.cho), which is the serializer that
    // writes the `{key: ...}` directive.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click(),
    ]);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const text = fs.readFileSync(filePath, 'utf8');

    // The regression assertion: these two lines are exactly what #455 restored.
    expect(text).toContain('{key: G}');
    expect(text).toContain('{key: C}');
    // A file that lost its key lines but also lost its songs would pass the
    // two assertions above, so pin the songs themselves.
    expect(text).toContain('{title: Way Maker}');
    expect(text).toContain('{title: Oceans (Where Feet May Fail)}');
  });

  test('an accepted view-only collaborator sees the setlist', async ({ page }) => {
    await loginAsIsolation(page);
    await page.goto(setlistPath);

    // RLS admits the owner and an ACCEPTED collaborator, and the isolation
    // user is the seed's accepted one. The badge is what separates this render
    // from the owner's: same page, same items, no edit controls.
    await expect(page.getByRole('heading', { name: 'Demo Setlist' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('View only', { exact: true })).toBeVisible();
    expect(await renderedSongIds(page)).toEqual([wayMakerId, oceansId]);

    // The song TITLES are deliberately not asserted here. `songs` RLS is
    // org/branch scoped, so this collaborator can read `setlist_items` (the two
    // rows above, with their agreed keys) but not the demo org's songs, and the
    // page renders them as "(missing song)". Asserting the titles would encode
    // a fix that lives in `supabase/migrations/`, not in this slice; asserting
    // the placeholder would pin the gap as intended behaviour.
  });

  test('a pending collaborator is told the setlist does not exist', async ({ page }) => {
    await loginAsOutsider(page);
    await page.goto(setlistPath);

    // The outsider's `setlist_collaborators` row has `accepted_at IS NULL`, so
    // `setlists_select_member` hides the row and the page falls back to its
    // not-found branch. A 404 page that leaks the setlist name or its items is
    // the thing this test refuses.
    await expect(page.getByText('Setlist not found.')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Demo Setlist' })).toHaveCount(0);
    await expect(page.getByText('Way Maker')).toHaveCount(0);
    await expect(page.locator('[data-song-id]')).toHaveCount(0);
  });

  test('a collaborator who cannot read the songs is not told the export worked', async ({ page }) => {
    await loginAsIsolation(page);
    await page.goto(setlistPath);

    const downloadButton = page.getByRole('button', { name: 'Download' });
    await expect(downloadButton).toBeVisible({ timeout: 15_000 });

    // The other half of the seam: this collaborator reads `setlist_items` but
    // not the demo org's `songs`, so every row is skipped and the serialized
    // file would be empty. The page used to answer that with
    // "Downloaded demo-setlist.cho with 2 songs" over a 0-byte download.
    await downloadButton.click();

    await expect(page.getByText(/nothing to export/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Downloaded demo-setlist\.cho/)).toHaveCount(0);
  });
});
