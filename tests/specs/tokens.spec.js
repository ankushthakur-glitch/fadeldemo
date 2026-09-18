// TOKEN GUARD — the rule-keeper for the design system.
//
// In plain language: component CSS is only allowed to *reference* design
// decisions, never to *make* them. So any file under /css/components/ that
// spells out a literal colour or a literal font-size fails this test.
// All real values live in one place: /css/tokens.css.
//
// Why it matters to you as the designer: this is what makes a future dark
// theme (or a client re-skin) a one-file job instead of a hunt through
// forty component files.

import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const COMPONENT_CSS_DIR = join(ROOT, 'css', 'components');
const CSS_DIR = join(ROOT, 'css');

/** Every screen-*.css — the per-screen sheets, not the shared component ones. */
function screenStylesheets() {
  return readdirSync(CSS_DIR)
    .filter((name) => name.startsWith('screen-') && name.endsWith('.css'))
    .map((name) => join(CSS_DIR, name));
}

/** Every .css file under /css/components/, recursively. */
function componentStylesheets(dir = COMPONENT_CSS_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return componentStylesheets(full);
    return entry.name.endsWith('.css') ? [full] : [];
  });
}

/** Strip /* comments *​/ so a hex written inside a note doesn't fail the build. */
function withoutComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Same, but the file keeps its shape: every comment becomes blanks and its
 * newlines survive, so a reported line number still points at the real line.
 */
function blankedComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, ' '));
}

const BANNED = [
  {
    label: 'raw hex colour (e.g. #1a73e8)',
    // #abc, #abcd, #aabbcc, #aabbccdd
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
  },
  {
    label: 'raw rgb()/rgba() colour',
    pattern: /\brgba?\s*\(/g,
  },
  {
    label: 'raw hsl()/hsla() colour',
    pattern: /\bhsla?\s*\(/g,
  },
  {
    label: 'named CSS colour (e.g. red, white)',
    // Deliberately narrow: only the ones people reach for by accident.
    // `transparent`, `currentColor` and `inherit` are allowed on purpose.
    pattern: /:\s*(?:white|black|red|green|blue|grey|gray|orange|yellow|silver)\s*(?:!|;|\))/gi,
  },
];

/*
 * font-size / font-family need a different shape of check. A negative
 * lookahead after `\s*` is unreliable — the engine backtracks the whitespace
 * and the lookahead then passes on a space, flagging perfectly good
 * `font-size: var(--font-size-md)` lines. So capture the value instead and
 * judge it directly.
 */
const TOKEN_ONLY_PROPS = [
  { prop: 'font-size', label: 'font-size' },
  { prop: 'font-family', label: 'font-family' },
];

const ALLOWED_VALUE = /^(var\(|inherit|initial|unset)/;

function typeViolations(line) {
  const found = [];
  for (const { prop, label } of TOKEN_ONLY_PROPS) {
    const match = line.match(new RegExp(`${prop}\\s*:\\s*([^;}]+)`));
    if (match && !ALLOWED_VALUE.test(match[1].trim())) {
      found.push(`hardcoded ${label} — must be var(--${label}-*)`);
    }
  }
  return found;
}

test.describe('design tokens @tokens', () => {
  test('component CSS exists to lint', () => {
    // A silent zero-file pass would let a broken folder path hide real
    // violations forever, so we assert the linter actually has work to do.
    const files = componentStylesheets();
    expect(
      files.length,
      `No stylesheets found under /css/components/. Either the folder moved or components have not been built yet.`
    ).toBeGreaterThan(0);
  });

  test('component CSS contains only tokens — no literal colours or type sizes', () => {
    const violations = [];

    for (const file of componentStylesheets()) {
      const relative = file.slice(ROOT.length).replace(/\\/g, '/');
      const source = withoutComments(readFileSync(file, 'utf8'));
      const lines = source.split('\n');

      lines.forEach((line, index) => {
        for (const rule of BANNED) {
          rule.pattern.lastIndex = 0;
          if (rule.pattern.test(line)) {
            violations.push(
              `${relative}:${index + 1} — ${rule.label}\n      ${line.trim()}`
            );
          }
        }
        for (const label of typeViolations(line)) {
          violations.push(`${relative}:${index + 1} — ${label}\n      ${line.trim()}`);
        }
      });
    }

    expect(
      violations,
      `Hardcoded values found in component CSS. Move each one into /css/tokens.css and reference it with var(--token):\n\n  ${violations.join(
        '\n  '
      )}\n`
    ).toEqual([]);
  });

  /**
   * ELEVATION IS A CLAIM, AND THERE ARE ONLY THREE OF THEM.
   *
   * A drop shadow says "this is in front of the page". Screens may only make
   * that claim through --elevation-flat / -raised / -overlay, which are named
   * for what is true rather than for how dark they are. Reaching past them to
   * a raw --shadow-* is how the app ended up with four different elevations
   * for the same job — a plain card — and a screen of tiles each casting a
   * shadow onto the tile behind it.
   *
   * The raw scale stays available to /css/components/, which is where the
   * genuinely physical affordances live (a toggle knob, a menu).
   */
  test('screens claim elevation semantically, never with a raw shadow', () => {
    const RAW_SHADOW = /box-shadow:\s*var\(\s*--shadow-/;
    const violations = [];

    for (const file of screenStylesheets()) {
      const relative = file.slice(ROOT.length).replace(/\\/g, '/');
      withoutComments(readFileSync(file, 'utf8'))
        .split('\n')
        .forEach((line, index) => {
          if (RAW_SHADOW.test(line)) {
            violations.push(`${relative}:${index + 1} —\n      ${line.trim()}`);
          }
        });
    }

    expect(
      violations,
      `Screen CSS must use --elevation-flat / --elevation-raised / --elevation-overlay.\n` +
        `If none of the three fits, the layout has a level too many — take one out\n` +
        `rather than adding a fourth shadow:\n\n  ${violations.join('\n  ')}\n`
    ).toEqual([]);
  });

  /**
   * ONE PAGE HEADER. Every screen's top band is .ui-page-head in base.css; a
   * screen that redeclares its geometry is the start of the drift that had
   * eleven headers with five paddings between them.
   */
  test('no screen redeclares the page header band', () => {
    /* The classes to police are read out of the markup rather than listed
       here, so adding a screen puts its header under the rule automatically
       and a renamed one never silently falls out of it. */
    const companions = new Set();
    for (const name of readdirSync(join(ROOT, 'screens'))) {
      if (!name.endsWith('.html')) continue;
      const html = readFileSync(join(ROOT, 'screens', name), 'utf8');
      for (const [, list] of html.matchAll(/class="([^"]+)"/g)) {
        const classes = list.split(/\s+/);
        // `ui-page-head` exactly — not `ui-page-head-tabs`, which is the band's
        // SECOND row and legitimately has its own layout.
        if (!classes.includes('ui-page-head')) continue;
        for (const cls of classes) {
          if (cls.startsWith('ui-page-head')) continue;
          companions.add(cls);
        }
      }
    }

    expect(companions.size, 'no page headers found to lint').toBeGreaterThan(0);

    // Vertical padding, alignment and the band's own colours belong to the
    // shared rule. A screen may still set padding-inline for its own gutter.
    const GEOMETRY = /^\s*(padding|align-items|background-color|border-bottom|min-height)\s*:/;
    const violations = [];

    for (const file of screenStylesheets()) {
      const relative = file.slice(ROOT.length).replace(/\\/g, '/');
      const lines = blankedComments(readFileSync(file, 'utf8')).split('\n');

      lines.forEach((line, index) => {
        const selector = line.match(/^\.([a-z_]+)\s*\{/);
        if (!selector || !companions.has(selector[1])) return;

        // A one-line rule declares and closes on the same line; a block runs
        // until its closing brace. Either way, only that rule's own
        // declarations are read — walking past the brace would blame this
        // selector for whatever rule happens to follow it.
        const body = line.includes('}')
          ? [{ text: line.slice(line.indexOf('{') + 1, line.indexOf('}')), at: index }]
          : (() => {
              const out = [];
              for (let i = index + 1; i < lines.length && !lines[i].includes('}'); i += 1) {
                out.push({ text: lines[i], at: i });
              }
              return out;
            })();

        for (const { text, at } of body) {
          for (const decl of text.split(';')) {
            if (GEOMETRY.test(`${decl};`)) {
              violations.push(
                `${relative}:${at + 1} — .${selector[1]} redeclares ${decl.trim()}`
              );
            }
          }
        }
      });
    }

    expect(
      violations,
      `These belong to .ui-page-head in css/base.css. A screen may add what is\n` +
        `genuinely different about it, but not restate the band:\n\n  ${violations.join(
          '\n  '
        )}\n`
    ).toEqual([]);
  });

  test('components reference semantic tokens, not primitives', () => {
    // Two-tier system: primitives (--color-blue-600) describe *what a colour is*,
    // semantics (--color-text-primary) describe *what it is for*. Components
    // must only ever speak in intent, so re-theming stays a semantic-layer edit.
    const PRIMITIVE = /var\(\s*(--color-(?:stone|oxblood|blue|grey|gray|red|green|amber|orange|yellow|purple|teal|neutral|slate)-\d{1,3})/g;
    const violations = [];

    for (const file of componentStylesheets()) {
      const relative = file.slice(ROOT.length).replace(/\\/g, '/');
      const source = withoutComments(readFileSync(file, 'utf8'));
      source.split('\n').forEach((line, index) => {
        PRIMITIVE.lastIndex = 0;
        let match;
        while ((match = PRIMITIVE.exec(line)) !== null) {
          violations.push(`${relative}:${index + 1} — uses primitive ${match[1]}`);
        }
      });
    }

    expect(
      violations,
      `Components must use semantic tokens (--color-text-primary, --color-bg-surface, …), not primitives:\n\n  ${violations.join(
        '\n  '
      )}\n`
    ).toEqual([]);
  });
});
