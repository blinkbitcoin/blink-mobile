---
name: blink-figma-to-code
description: MUST be loaded before any blink-mobile UI work that involves a Figma link (figma.com/design/…), whether the link is in the user's message, a GitHub issue or ticket, a PR description or a comment. Finds the existing React Native code a Figma node stands for and changes it to Figma's layout, spacing, type, colour, icons and copy using the app's theme tokens, then audits it 1:1. Triggers on build, implement, modify, update, restyle, redesign, fix the UI of, "make it match Figma", or "check against Figma" for any screen, component, sheet, modal or row. Not for HTML prototypes.
---

# Blink Figma → code

Goal: one pass that leaves the RN code matching the Figma node, plus an audit table that
proves it and lists every place where the design and the code disagree.

## Installing (once per machine)

The skill ships with the repo, so Claude Code finds it with no setup. To also load it
automatically whenever a Figma link appears in a message or in a ticket fetched with `gh` /
WebFetch, register `hooks/figma-link.sh` in your own `.claude/settings.local.json` (it is
git-ignored, so each developer opts in):

```json
"hooks": {
  "UserPromptSubmit": [{ "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/skills/blink-figma-to-code/hooks/figma-link.sh", "timeout": 10 }] }],
  "PostToolUse": [{ "matcher": "Bash|WebFetch", "hooks": [{ "type": "command", "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/skills/blink-figma-to-code/hooks/figma-link.sh", "timeout": 10 }] }]
}
```

It needs `jq` and `chmod +x` on the script. Check with `/hooks`.

## Before you start: Figma access

The skill needs both Figma MCP servers. Check that their tools exist in this session
(`mcp__…Figma__get_design_context` / `use_figma`, and `mcp__figma__get_figma_data`). If
either is missing, stop and give the developer these steps:

1. **Official Figma MCP** (required). In Claude Code: `/plugin install
   figma@claude-plugins-official`, or `claude mcp add --transport http figma
   https://mcp.figma.com/mcp`. Then `/mcp` → figma → authenticate in the browser with a
   Figma account that can open the Blink file.
2. **Framelink MCP** (local, used for image exports). Create a personal access token in
   Figma (Settings → Security → Personal access tokens, read-only file content), then
   `claude mcp add figma-local -e FIGMA_API_KEY=<token> -- npx -y figma-developer-mcp
   --stdio`. Don't put the token in blink-mobile's `.env`: every `.env` key is compiled
   into the Android build.
3. Restart Claude Code, run `/mcp`, and confirm both are connected.

A public Figma link can't be read without one of these: it only renders in a logged-in
browser. If the developer won't set them up, the only fallback is that they paste a
screenshot of the frame and the values from Figma's Dev Mode inspect panel. Say clearly
that the result can't then be 1:1, and audit only what was pasted.

Load the official `figma:figma-design-to-code` skill before the first
`get_design_context` call, and `figma:figma-use` before any `use_figma` call (the Figma
MCP requires both). Where they and this skill differ, this skill wins. In particular, they
may tell you to modify a matched component; here a shared component's defaults never
change (rule 2).

## Rules

1. **The theme wins over Figma values.** Use the token the Figma variable maps to, even
   when its value differs (`grey0` is `#FAF9F9` in code, `#f2f2f4` in Figma →
   `colors.grey0`). Never override a token's value locally, never edit `theme.ts` or
   `colors.ts`. Each difference goes in the report. Known ones are in
   [references/token-map.md](references/token-map.md).
2. **Reuse before you build, and never change a shared default.** Look for an existing
   component first, including one that is only *almost* it (same structure, different
   icon, colour or copy), even when Figma doesn't name it. If it needs something it can't
   do yet, add an optional prop whose default reproduces today's output exactly. Never
   build a lookalike of something that exists.
3. **New UI lives as close to its screen as possible** (see *Placing new UI*).
4. **Figma's copy is the approved copy.** It wins over the app's English, on new and
   existing keys. Stop and ask when a string obviously contradicts what the element does
   (a copy button labelled "Paste", a cancel button labelled "Confirm").
5. **UI first; logic only by reuse, and only after asking.** Simple behaviour (a switch,
   show/hide, expand/collapse) may be wired *only* by reusing a mechanism that already
   exists in the code, and only after the developer says yes. Never invent new logic,
   navigation, steps or API calls.
6. **Verification is a code audit**, not a screenshot. Every visible Figma node gets a
   row; every property on it is checked against the code. See
   [references/audit.md](references/audit.md).
7. **No commits, branches, PRs or new tests unless the developer asks.** Run the existing
   checks (step 5).

## Inputs

- A Figma URL with `node-id`. File key `9MQuQi8ZhXVvDibWSI3C4c` is the Blink app file.
  Convert `node-id=1-2` → `1:2`. No `node-id` → ask for one, don't guess.
- Which screen/route it is in the app, if the developer knows. If not given, find it
  (step 2).
- **A whole screen or one component?** A link to a single component (a card, a row)
  changes that component only on the screens the developer names, not everywhere it
  appears.

## Workflow

### 1. Read the design

1. `create_session` with the file key; reuse the session id on every Figma call.
2. `get_design_context` on the node (`clientFrameworks: react-native`,
   `clientLanguages: typescript`, `skillNames: figma-design-to-code`). Keep its screenshot:
   it is what "done" looks like. If the response is sparse, request the visible children
   in one parallel batch.
3. `get_variable_defs` on the same node, for the variable **names** only. Its values can
   be stale (on 2026-10-27 it reported values the file no longer had). Read the values
   from the live file instead, with one read-only `use_figma` call:

   ```js
   const hex = (c) => '#' + [c.r, c.g, c.b].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('') + (c.a < 1 ? ` a${Math.round(c.a * 100) / 100}` : '');
   const out = [];
   for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
     out.push(`## ${c.name} [${c.modes.map(m => m.name).join(', ')}]`);
     for (const id of c.variableIds) {
       const v = await figma.variables.getVariableByIdAsync(id);
       const vals = [];
       for (const m of c.modes) {
         const x = v.valuesByMode[m.modeId];
         vals.push(x?.type === 'VARIABLE_ALIAS' ? '→' + (await figma.variables.getVariableByIdAsync(x.id))?.name : typeof x === 'object' && 'r' in x ? hex(x) : String(x));
       }
       out.push(`${v.name} | ${vals.join(' | ')}`);
     }
   }
   for (const s of await figma.getLocalTextStylesAsync()) out.push(`${s.name} | ${s.fontSize}/${s.lineHeight.value ?? s.lineHeight.unit}`);
   return out.join('\n');
   ```

   Compare it with [references/token-map.md](references/token-map.md); anything that
   moved goes in the report, and the map gets updated.
4. Note what the output gives you:
   - `var(--grey5,#f2f2f4)` gives the variable name and its *light* fallback. Map the
     name, not the hex.
   - `<CodeConnectSnippet>` with an `import … from "app/components/…"` means Figma
     already knows the code component. Its props are **Figma's** props (`text`, `state`,
     `withText`), not the component's; translate them with
     [references/figma-to-rn.md](references/figma-to-rn.md).
   - `data-name` on every layer is meant to be the kebab name of the code component
     (`icon-hero`, `button-group`). It often drifts (chip vs badge), so treat it as a
     hint. Confirm by structure and props before trusting it, and log every drift for
     the report.
   - A raw hex with no `var(--…)` is an unbound fill: a slip, not a new colour. Map it to
     a token by role and report it. Never put a hex in code.
   - Sample content (amounts, usernames, dates, `Text`) is example data. Keep the app's
     real data bindings.

**Screens are drawn in dark mode.** Figma's values are dark-theme values; light mode comes
from the token, so never paste a dark hex into code.

### 2. Find the code

Work from the outside in, and stop at the first hit for each node:

1. **Code Connect import** in the snippet → that file.
2. **Copy.** Search the visible English strings in `app/i18n/en/index.ts`, take the key,
   then `grep -rn "<Section>.<key>" app` → the component that renders it. This is the most
   reliable way to find the *screen*. (Figma copy may differ slightly from `en`; try
   distinctive words if the exact string misses.)
3. **Layer name** → `app/components/<name>/`, `app/components/atomic/<name>/`, then
   `app/screens/**/<name>*`. Then try synonyms (chip/badge/pill/tag, card/tile,
   sheet/modal, banner/bulletin), and confirm by structure.
4. **Route name** in the `app/navigation/` stack definitions, when the developer names
   the screen.

Build the node → code table now (Figma node id, layer name, file:line). Then sort every
visible node into one of three groups:

- **Matched**: an existing component or element renders it.
- **Near-match**: an existing component could render it with a prop it has, or one
  optional prop it doesn't have yet. Search before deciding a node is new: grep
  `app/components/` and the screen's feature folder for the same structure (icon + title
  + text, row with chevron, pill with label…).
- **New**: nothing renders it. Place it per *Placing new UI*.

A code element with no Figma node is UI the design dropped, or conditional UI Figma
doesn't draw. List it and ask before removing anything.

### 3. Diff, node by node

For every matched or near-match row, compare each property. Figma side from variables
first, raw values second. Code side from `makeStyles`, inline props and the component's
own defaults (read the shared component; `GaloyPrimaryButton` already has
`minHeight: 50`).

| Property | Figma | Code |
|---|---|---|
| Layout | `flex-col`, `items-*`, `justify-*`, sizing hug/fill/fixed | `flexDirection`, `alignItems`, `justifyContent`, `flex`/width |
| Spacing | `gap-*`, `p*-*` (variables `gap*`, `body-padding*`) | `gap`, `padding*`, `margin*` |
| Shape | `rounded-*`, `border*`, `h-`/`w-` | `borderRadius`, `border*`, sizes |
| Colour | `bg-`, `text-[color:…]`, `border-` | `colors.<key>` |
| Type | text style name (`Paragraph 3/Bold`) | `<Text type bold>` |
| Icon | component name + `type`/`weight`/size | `GaloyIcon name/size/weight` |
| Copy | literal string | `LL.…()` value in `en` |
| State | variant (`state=Disabled`, `theme=light`) | props, conditions in code |

### 4. Change the code

**Styling**

- Styles live in the file's `makeStyles(({ colors }) => …)` with the existing key style;
  colours only from `colors`. Spacing and radii are plain numbers (the app has no spacing
  tokens); use Figma's resolved number.
- Screen side padding is 20 (`body-padding`). Figma's fixed widths on text and containers
  (`w-[264px]`) come from the 360-wide frame. Use flex/fill so it works on every phone;
  keep a fixed size only for genuinely fixed things (icon circles, pull tabs, avatars).
- Text: `<Text type="pN">` from the text style (token-map.md), `bold` when the style is
  `/Bold`. Never write `fontWeight` or a bold `fontFamily`; the theme owns the weight. A
  style with no `type` (Paragraph 5, Heading balance) → `fontSize`/`lineHeight` in
  `makeStyles`.
- Icons only through `GaloyIcon`. A Phosphor glyph missing from its map → add the entry. A
  custom glyph → export the SVG from Figma into `app/assets/icons-redesign/` and add it
  to `customSvgMap`. Both are additive; report them.
- Keep `testProps(...)` and accessibility labels intact; new tappables get them too.

**Placing new UI**

Build new UI from the existing primitives (`Text`, `GaloyIcon`, the atomic buttons, the
pressable rows), then place it at the lowest level that covers every screen using it:

1. **One screen** → in that screen's file. If the file gets long, a file next to it.
2. **Several screens of one feature** → its own file in that feature's folder, like
   `app/screens/settings-screen/row.tsx` or `group.tsx`.
3. **Two or more features** → `app/components/<kebab-name>/` with an `index.ts`, and
   **only after the developer approves it**. A second feature using it makes it a
   candidate, not a decision: build it in the first feature's folder, propose the move,
   and wait. Repeating on a couple of screens doesn't make it global.

Name new files and components after the Figma layer name when it describes the element
well; otherwise pick a clear name and note the Figma name in the report.

**Copy**

- Figma's text is approved copy (rule 4). Update existing `en` strings to match it, and
  add new ones under the screen's existing i18n section.
- Every new or changed string gets a real translation in all 28 files under
  `app/i18n/raw-i18n/translations/` in the same change (CI's locale-parity test fails
  otherwise, and a changed `en` string doesn't flow to locales that already translated
  it).
- **Never translate a string on its own.** Read the whole screen first so you know what
  the string does and where it sits. If its meaning still isn't clear, ask the developer
  to describe it in one sentence. Write what a native speaker would say in that spot,
  not a literal translation. Match each locale's existing wording for the same concepts
  (look at neighbouring keys in that file).
- Then `yarn update-translations` (slow; run it in the background). Never hand-edit
  `app/i18n/i18n-types.ts`. Mind the per-file indent (some locales use 2 spaces, some 4).
- Never touch `app/graphql/generated.ts`.

**Behaviour** (rule 5): if the frame shows a switch, a show/hide, an expand/collapse or a
new state, find the existing code that already does that elsewhere and propose reusing
it. Ask before wiring it. If nothing exists, build the visuals only and list it under
*Questions*.

### 5. Audit and report

Fill the audit in [references/audit.md](references/audit.md), fix every row that isn't
✅ or a reported token mismatch, then run on the touched files:

```bash
yarn tsc:check
yarn eslint --fix <files> && yarn eslint:check
yarn test <spec of each touched component>   # only specs that already exist
```

End with the report (template in audit.md). It is the deliverable as much as the code:
the token mismatches, naming drift and open questions are decisions someone else has to
make.

## When to stop and ask

- Figma access is missing (see *Before you start*).
- The node can't be found in code and it isn't clearly new UI.
- The design drops UI the code shows.
- The frame implies behaviour: a new step, destination, condition or API call (rule 5).
- A Figma string contradicts what its element does (rule 4), or its meaning isn't clear
  enough to translate.
- A frame shows several states and the code has no matching condition for one of them.
- Two Figma frames for the same screen disagree.
