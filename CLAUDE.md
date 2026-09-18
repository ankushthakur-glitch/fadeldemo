# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`medinova-ehr` — a clickable front-end prototype for a data-dense
EHR/EMR ("MediNova EHR"). Vanilla HTML/CSS/JS plus native Web Components. No
framework, no build step: every page is a real `.html` file served statically.
Playwright is dev tooling only and is never imported by prototype code.

Two products live side by side:

| Path        | What it is                                                    |
| ----------- | ------------------------------------------------------------- |
| `screens/`  | The clinician-facing EHR. Entry point is `screens/login.html`. |
| `patient/`  | The patient portal, its own shell, tokens and CSS.             |

`index.html` is a redirect to `screens/login.html` (guarded so a `file://`
copy shows the "open me properly" warning instead of bouncing).
`gallery.html` is the component reference, not a screen.

## Layout

- `css/tokens.css` — design tokens. Two tiers: **primitives** (raw values,
  MediNova's own names) and **semantics** (role names). Components use only
  semantics. Every token is tagged `[FIGMA]` (read from the MediNova Figma file)
  or `[DERIVED]` (built from a Figma anchor to fill a gap). Do not change a
  `[FIGMA]` value without changing Figma first.
- `css/screen-*.css` — one stylesheet per screen; `css/components/` — one per
  component.
- `js/components/ui-*.js` — the `ui-` custom elements.
- `js/lib/` — shared helpers (`base-element.js`, `icons.js`, `main-nav.js`,
  stores).
- `js/screens/` — one module per screen, matching the `screens/*.html` file.
- `data/` — mock data modules. No network, no backend.
- `patient/` mirrors this structure with its own `css/`, `js/`, `data/`.
- `tests/` — Playwright specs, helpers, screenshots, and Figma reference images.

## Conventions

- **Web Components:** extend `UiElement` (`js/lib/base-element.js`). No Shadow
  DOM anywhere — everything renders into the light DOM so global tokens cascade
  in and styles stay inspectable. Mirror attributes onto properties, fire
  events through `emit()`, and render only once connected.
- **Styling:** semantic tokens only. Never hard-code a colour, spacing or font
  value in a screen or component stylesheet.
- **ES modules** throughout (`"type": "module"`), loaded with
  `<script type="module">`. Classic scripts only where a module cannot run
  (e.g. the `file://` guard in `index.html`).
- **Comments** in this codebase explain *why*, at length, in prose. Match that
  register when editing a file — terse one-liners read as foreign here.
- Record user-visible changes in `CHANGELOG.md`.

## Running it

```
npm start        # http-server on :4173  (needs node — see below)
npm test         # Playwright
npm run test:a11y
npm run test:tokens
```

### Environment caveats on this machine

- **No node available.** `npm start` / `npm test` cannot run. To verify UI,
  serve with `python3 -m http.server` and screenshot with
  `chrome-headless-shell`. Playwright tests cannot be executed here — say so
  rather than claiming they pass.
- **`patient/` is deployed from an uncommitted tree.** Git is behind what is
  live. Check `git status` and the working tree before editing anything under
  `patient/`.
- **Figma MCP is on a view seat with a tight rate limit.** Mine the metadata
  dump rather than screenshotting every frame.

## Skills

Every skill available in this session, in full. Invoke with the Skill tool or
by typing `/<name>` — exact names only, never a guess. When a task matches a
skill, load the skill instead of improvising.

### `design`

Create a design canvas: a multi-artboard visual design published as an Artifact
that runs Claude Design's canvas editor (an early preview of Claude Design
inside Claude Code). You draft the design as `.dc.html` artboards laid out on
one pan/zoom canvas; where saving is enabled for the account the user refines
every element visually (click-to-select, properties panel, inline text editing,
undo/redo) and Save publishes a new version, otherwise they get a
view-and-export (PNG/PDF) preview of the draft.

Use for: UI mockups and screen flows, landing pages, marketing and social
graphics, print pieces (posters, flyers, brochures as single-page artboards),
memos and reports as one flowing artboard — anything the user would rather
tweak by hand than in code. Only for **creating** or re-seeding a canvas; an
existing canvas is edited in its published Artifact.

### `dataviz`

Use whenever you are about to create **any** chart, graph, plot, dashboard or
data visualization, in **any** medium — HTML or React artifact, inline SVG,
plotting code in any library (matplotlib, plotly, d3, Recharts, …), an
image/PNG you render and upload, or a chart shared into Slack. Read it *before*
writing the first line of chart code, choosing chart colors, building a stat
tile / meter / KPI row, or laying out a dashboard.

Produces visualizations that read as one system — elegant, accessible,
consistent in light and dark — using a brand-neutral placeholder palette you
swap for your own. Teaches a design-system-agnostic method: a form heuristic, a
color formula with a runnable validator, mark specs, and interaction rules. A
validated default palette lives in `references/palette.md`.

Triggers on: chart, graph, plot, data viz, visualization, dashboard, analytics,
visualize data, categorical colors, sequential / diverging palette, stat tile,
sparkline, heatmap, legend, axis, tooltip, chart colors, color by series.

### `artifact-design`

Design guidance and fundamentals for Artifacts. Load **before writing any
artifact, including Markdown ones** — format choice is part of the design pass,
never a speed shortcut.

### `artifact-diagramming`

Diagramming know-how for Artifacts: when a picture earns its place, how to draw
one that shows the real mechanism, and the inline-SVG mechanics that keep it
legible in both light and dark themes.

### `artifact-capabilities`

Runtime capabilities a published Artifact page can be granted — behavior static
HTML cannot provide on its own: reading live or connected data, keeping state
shared across viewers, handing the viewer a file to save, or updating and
republishing itself. Serves the live capability roster and the typed call
definitions. Load it whenever the user asks for an artifact needing any such
runtime behavior, and always before passing `capabilities` or writing any
`window.claude.*` runtime code.

### `code-review`

Review the current diff, or a PR number / branch / path target, for correctness
bugs and reuse / simplification / efficiency cleanups at a given effort level:

- `low` / `medium` — fewer, high-confidence findings
- `high` → `max` — broader coverage, may include uncertain findings
- `ultra` — deep multi-agent review in the cloud

With no level given it reuses the level typed last. `--comment` posts findings
as inline PR comments; `--fix` applies findings to the working tree after the
review. For `ultra` on a GitHub.com PR target, `--post` offers to post the
finished review's findings to the PR as a single comment from the user's GitHub
account (not a review), and `--no-post` hides that option.

`/code-review ultra` is user-triggered and billed — Claude cannot launch it.
`/ultrareview` is a deprecated alias for the same command. It needs a git
repository; the no-arg form bundles the local branch and needs no GitHub
remote.

### `simplify`

Review the changed code for reuse, simplification, efficiency and altitude
cleanups, then apply the fixes. Quality only — it does not hunt for bugs; use
`code-review` for that.

### `security-review`

Complete a security review of the pending changes on the current branch.

### `init`

Initialize a new CLAUDE.md file with codebase documentation. (This file was
authored by hand; re-running `init` would overwrite it.)

### `update-config`

Configure the Claude Code harness via `settings.json`. Automated behaviors
("from now on when X", "each time X", "whenever X", "before/after X") require
**hooks** configured in settings.json — the harness executes these, not Claude,
so memory or preferences cannot fulfill them.

Also use for: permissions ("allow X", "add permission", "move permission to"),
env vars ("set X=Y"), hook troubleshooting, or any change to
`settings.json` / `settings.local.json`. For simple settings like theme or
model, suggest the `/config` command instead.

### `keybindings-help`

Customize keyboard shortcuts, rebind keys, add chord bindings, or modify
`~/.claude/keybindings.json`. Examples: "rebind ctrl+s", "add a chord
shortcut", "change the submit key".

### `fewer-permission-prompts`

Scan transcripts for common read-only Bash and MCP tool calls, then add a
prioritized allowlist to project `.claude/settings.json` to reduce permission
prompts. Relevant here — `.claude/settings.local.json` still carries stale
Windows PowerShell entries from an earlier machine.

### `run`

Launch and drive this project's app to see a change working. Use when asked to
run, start, or screenshot the app, or to confirm a change works in the real app
(not just in tests). It first looks for a project skill that already covers
launching the app, then falls back to built-in patterns per project type (CLI,
server, TUI, Electron, browser-driven, library). In this repo that means a
static server plus a browser — and note node is unavailable on this machine.

### `loop`

Run a prompt or slash command on a recurring interval, e.g. `/loop 5m /foo`.
Omit the interval to let the model self-pace. Use when the user wants a
recurring task, to poll for status, or to run something repeatedly ("check the
deploy every 5 minutes", "keep running /babysit-prs"). Not for one-off tasks.

### `schedule`

Create, update, list or run scheduled cloud agents (routines) that execute on a
cron schedule. Use when the user wants to schedule a recurring cloud agent, set
up automated tasks, create a cron job for Claude Code, or manage existing
routines. Also handles one-time scheduled runs ("run this once at 3pm",
"remind me to check X tomorrow").

### `claude-api`

Reference for the Claude API / Anthropic SDK — model ids, pricing, params,
streaming, tool use, MCP, agents, caching, token counting, model migration.

Read it **before** opening the target file — do not skip because it "looks like
a one-liner" — whenever: the prompt names Claude/Anthropic in any form (Claude,
Anthropic, Fable, Opus, Sonnet, Haiku, `anthropic`, `@anthropic-ai`,
`claude-*`, `us.anthropic.*`, `[1m]`); the user asks about an LLM (pricing,
model choice, limits, caching) — never answer from memory; or the task is
LLM-shaped with the provider unstated (agent, MCP, tool definition,
multi-agent, RAG, LLM-judge, computer-use; generate / summarize / extract /
classify / rewrite / converse over natural language; debugging refusals,
cutoffs, streaming, tool calls, tokens).

Skip only when another provider is being worked on (this overrides all
triggers): OpenAI/GPT, Gemini, Llama, Mistral, Cohere or Ollama named in the
query; or `grep -rE 'openai|langchain_openai|google.generativeai|genai|mistralai|cohere|ollama'`
over the project hits — run that grep first when no provider is named.

### Figma MCP skills

Served by the Figma MCP server (prefer the skills shipped with an installed
Figma plugin; otherwise the `skill://figma/...` resources). They resolve only
once the Figma connector is authorized.

- **`figma-use`** — **mandatory** before calling `use_figma`.
  Fallback: `skill://figma/figma-use/SKILL.md`
- **`figma-generate-design`** — translate an app page or layout into Figma.
- **`figma-generate-library`** — build a design system in Figma from code.
- **`figma-code-connect`** — map Figma components to codebase components.
- **`figma-use-figjam`** — FigJam-specific `use_figma` guidance.

Because `css/tokens.css` marks tokens `[FIGMA]` vs `[DERIVED]`, Figma is the
source of truth for visual values here — read design context from it rather
than eyeballing screenshots, and mind the view-seat rate limit.

## Subagents

Available to the Agent tool. Do not spawn one unless the user asks for it.

- **`claude`** — catch-all for tasks with no more specific agent. All tools.
- **`claude-code-guide`** — questions about Claude Code (hooks, slash commands,
  MCP servers, settings, IDE integrations, shortcuts), the Claude Agent SDK,
  the Claude API (Messages API, Tool Runner, manual tool-use loops, Managed
  Agents, prompt caching, token counting), Claude Tag / Claude in Slack, and
  `claude plugin eval` / `/skill-doctor`. Continue an existing one with
  SendMessage rather than spawning another.
- **`Explore`** — read-only fan-out search across many files and naming
  conventions; returns conclusions, not file dumps. Locates code; does not
  review it. Specify breadth ("medium", "very thorough").
- **`general-purpose`** — research, multi-step tasks, and searches you are not
  confident will land in the first few tries.
- **`Plan`** — software architect: step-by-step implementation plans, critical
  files, architectural trade-offs. Read-only.
- **`statusline-setup`** — configure the status line setting.

## MCP servers

Connected: Atlassian Rovo (Jira/Confluence/Compass), Figma, Gmail, Google
Drive, Vibe Prospecting, DataForSEO. **claude.ai** and **WordPress.com** need
authorization before their tools work — via claude.ai connector settings for
claude.ai connectors, or `claude mcp` / `/mcp` in an interactive session.

For Atlassian, use `getTeamworkGraphContext` for relationships between
entities (work items, people, teams, goals, projects), not for basic CRUD, and
follow up with `getTeamworkGraphObject` on key linked entities.
