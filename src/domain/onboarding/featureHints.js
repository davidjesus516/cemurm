// @ts-check
// Pure version gate for the "Live Performance Mode" feature tooltip (S2).
// The tooltip is tied to the version that introduced the feature, not a
// one-shot boolean: a user who saw it before an update sees it again once the
// introducing version changes. No DOM, no storage — the caller owns both.

/**
 * @param {string | null | undefined} seenVersion the version the tooltip was last seen on
 * @param {string} currentVersion the version that currently introduces the feature
 * @returns {boolean}
 */
export function shouldShowFeatureTooltip(seenVersion, currentVersion) {
  // A legacy 'true' boolean carries no version, so it cannot satisfy the gate.
  return seenVersion !== currentVersion
}
