import { expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Fail the test on any console error or unhandled rejection.
 * Call at the top of a test, before navigating.
 *
 * ONE exception, and it is not the app's: every screen pulls Inter from
 * Google Fonts, and that fetch intermittently 404s or aborts in CI, logging
 * "Failed to load resource" against whichever test happened to be running.
 * It made the guard fail at random across the whole suite while telling us
 * nothing about our own code — a flaky guard is one people learn to re-run
 * rather than read.
 *
 * Only THIRD-PARTY resource failures are ignored. A 404 for anything this
 * prototype actually ships — a stylesheet, a module, an image — is
 * same-origin, is not matched here, and still fails the test.
 */
const THIRD_PARTY_RESOURCE = /Failed to load resource.*$/;

function isThirdPartyResourceError(message, location) {
  if (!THIRD_PARTY_RESOURCE.test(message)) return false;
  const url = location?.url ?? '';
  return /^https?:\/\//.test(url) && !url.includes('127.0.0.1') && !url.includes('localhost');
}

export function failOnConsoleErrors(page) {
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    if (isThirdPartyResourceError(msg.text(), msg.location())) return;
    problems.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  return () => {
    expect(problems, `Console was not clean:\n${problems.join('\n')}`).toEqual([]);
  };
}

/**
 * Open a patient chart and clear the Alerts and Due Recommendations digest.
 *
 * The digest opens on EVERY chart page load by design (see the BOOT block in
 * js/screens/patient-chart.js) — it is a real product behaviour, not a test
 * artefact, and there is deliberately no "already seen" flag a fixture could
 * pre-seed. So any test whose subject is something else has to get past it
 * first, and does it the way a user would: by closing it.
 *
 * Tests that are ABOUT the digest use page.goto directly instead.
 */
export async function openChart(page, url) {
  await page.goto(url);
  const close = page.getByTestId('chart--alerts-summary-close').locator('button');
  await close.click();
  await expect(page.locator('#alertsSummaryModal .ui-modal')).toBeHidden();

  /*
   * Park the pointer in the corner.
   *
   * Closing the digest leaves the mouse wherever the button was — which is
   * the middle of the page, on top of whatever table is underneath. That row
   * then sits in :hover for the rest of the test, and a hovered row is a
   * different colour: the contrast checks start measuring link text against
   * the hover grey (#f3f2f1) instead of the row's real background, and report
   * a failure that no user could ever see.
   */
  await page.mouse.move(0, 0);
}

/* ---------------------------------------------------------------------------
 * KNOWN CONTRAST FAILURES INHERITED FROM FIGMA
 *
 * The brief says: if a Figma colour pair fails WCAG AA, build it as designed
 * and flag it rather than silently "fixing" the brand. These are the pairs
 * MediNova itself defines that do not reach 4.5:1. They are listed explicitly —
 * NOT suppressed as a category — so that any *new* contrast regression we
 * introduce ourselves still fails the suite loudly.
 *
 * Each entry must be resolved in Figma, not in CSS.
 * ------------------------------------------------------------------------ */
export const FIGMA_CONTRAST_DEBT = [
  {
    pair: '#ffffff on #c8641b',
    ratio: 3.96,
    token: 'Warning/07 as a solid fill with white text',
    note: 'Inactive status badge, solid variant.',
  },
  {
    pair: '#c8641b on #fef4e5',
    ratio: 3.64,
    token: 'Warning/07 on Warning/01',
    note: 'Inactive status badge, soft variant — the one GastroEMR actually draws.',
  },
  {
    pair: '#6782ea on #ffffff',
    ratio: 3.52,
    token: 'Primary/500 as link text',
    note:
      'GastroEMR\'s blue from the input-fields component. Patient-name links use ' +
      'it as designed. A darker step (--color-info-08, #3a55b8, 5.6:1) exists ' +
      'and should replace it if Figma adds a Primary/700.',
  },
];

function isKnownFigmaDebt(node) {
  const data = node.any?.[0]?.data;
  if (!data?.fgColor || !data?.bgColor) return false;
  return FIGMA_CONTRAST_DEBT.some(
    (known) =>
      known.pair.toLowerCase() ===
      `${data.fgColor} on ${data.bgColor}`.toLowerCase()
  );
}

/**
 * Assert zero WCAG 2.1 A/AA violations.
 *
 * Contrast is reported separately from everything else, because a contrast
 * failure can be inherited from the design file while a missing label or a
 * bad ARIA attribute is always our bug.
 */
export async function expectNoA11yViolations(page, selector) {
  const builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
  ]);
  if (selector) builder.include(selector);

  const results = await builder.analyze();

  const structural = results.violations.filter((v) => v.id !== 'color-contrast');
  const contrast = results.violations.filter((v) => v.id === 'color-contrast');

  // 1. Structural violations are always ours. Zero tolerance.
  const structuralSummary = structural
    .map((v) => `${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.help}`)
    .join('\n');
  expect(
    structural,
    `Structural a11y violations (these are our bugs, not Figma's):\n${structuralSummary}`
  ).toEqual([]);

  // 2. Contrast: only the documented Figma-inherited pairs are tolerated.
  const unexpected = contrast.flatMap((v) =>
    v.nodes.filter((node) => !isKnownFigmaDebt(node))
  );
  const unexpectedSummary = unexpected
    .map((n) => `  ${n.failureSummary?.replace(/\s+/g, ' ').trim()}`)
    .join('\n');
  expect(
    unexpected,
    `New contrast failures not attributable to the GastroEMR palette:\n${unexpectedSummary}\n` +
      `If one of these really does come from Figma, add it to FIGMA_CONTRAST_DEBT ` +
      `with its ratio so it stays visible in the handover.`
  ).toEqual([]);
}

/** Measured pixel height of an element — used for the density assertions. */
export async function heightOf(locator) {
  const box = await locator.boundingBox();
  return box?.height ?? 0;
}
