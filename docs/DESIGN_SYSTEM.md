# Drafting Assistant design system

## Product frame

**Subject:** a private drafting instrument for professionals responding on LinkedIn.

**Audience:** people who want a credible starting point without handing control of their voice or account to automation.

**Single job:** move one user-selected conversation from context to a reviewed, editable, copy-ready draft.

The interface should feel like a focused writing tool, not a marketing page, analytics dashboard, or AI control center.

## Experience principles

1. **Work before explanation.** Put the current task, result, or next action first. Supporting context follows only where it changes a decision.
2. **One decision at a time.** Each surface has one visually dominant action. Secondary and destructive actions stay visibly quieter.
3. **Trust through plain language.** State what is read, sent, stored, and posted in direct sentences. Do not repeat privacy promises as decoration.
4. **Progressive disclosure.** Required setup stays in the main path. Optional discovery, voice training, diagnostics, and developer details stay collapsed or secondary.
5. **Editing is the product.** Draft text receives the largest and calmest area. Copy is the completion action; generation is only an intermediate state.
6. **Density with breathing room.** The side panel is narrow, so spacing should separate decisions—not create oversized cards.

## Visual direction: The working document

The system takes cues from a well-edited manuscript: cool blue-gray paper, deep navy text, restrained rules, and a single editorial-teal proofing mark. Harbor Blue connects the product to its professional context without copying LinkedIn blue. It avoids both monochrome black-and-white and the previous bright-blue dashboard treatment.

The aesthetic risk is the **proofing rail**: a 3 px green vertical rule that marks the active or completed work area. It makes the interface identifiable while carrying real state, and it is used only for the primary current task, active setup step, or selected draft.

## Foundations

### Color

| Token     | Value     | Use                                                    |
| --------- | --------- | ------------------------------------------------------ |
| `canvas`  | `#F3F6FA` | Extension and setup background                         |
| `surface` | `#FCFDFE` | Working surfaces and fields                            |
| `ink`     | `#203247` | Primary text                                           |
| `muted`   | `#64748B` | Supporting copy and metadata                           |
| `primary` | `#365F91` | Primary actions and selected navigation                |
| `proof`   | `#3D7C78` | Active state, focus, completion, and the proofing rail |

Rules, fields, and passive fills are cool tints derived from the six foundations: rule `#D5DEE8`, tint `#EAF0F6`, and soft surface `#F7F9FC`. Semantic colors remain quieter variants: warning `#8A5A16` on `#FFF8E8`, danger `#A33B3B` on `#FFF4F3`, and success `#2E6F63` on `#EDF7F4`.

### Typography

- **Display / headings:** `Aptos Display`, `Avenir Next`, `Segoe UI Variable Display`, system sans. Tight tracking, 650–700 weight. Used sparingly for product and page titles.
- **Body / controls:** `Aptos`, `Segoe UI Variable Text`, `Segoe UI`, system sans. Neutral, highly legible, 400–650 weight.
- **Utility / metadata:** `SFMono-Regular`, `Cascadia Mono`, `Roboto Mono`, monospace. Used only for step labels, provider names, counts, and timestamps.

Type scale:

| Role          | Size / line height | Weight |
| ------------- | ------------------ | ------ |
| Product title | `20 / 24`          | 680    |
| View title    | `18 / 23`          | 680    |
| Section title | `14 / 19`          | 680    |
| Body          | `13 / 20`          | 430    |
| Control       | `12 / 16`          | 650    |
| Meta          | `10 / 14`          | 600    |

Sentence case is required. Uppercase is reserved for short utility metadata and never used for conversational headings.

### Spacing and shape

- Base unit: `4px`.
- Common spacing: `8, 12, 16, 24, 32px`.
- Side panel gutter: `16px`; setup gutter: `24px` desktop and `16px` mobile.
- Control height: `40px`; compact control: `32px`.
- Radius: `8px` controls, `10px` surfaces, full radius only for status dots or compact status pills.
- Shadow: none by default. A small `0 8px 24px rgba(23, 32, 29, .08)` shadow is reserved for floating overlays.

## Layout

### Side panel

The current task begins immediately under a compact identity row. Navigation is a bottom dock so the working document keeps the stable top position and the primary action remains close to the thumb at narrow widths.

The identity row keeps `Local` in the workspace subtitle and reserves its compact trailing action for the always-visible Support link. Support does not receive a second placement in Settings, and it never occupies space beside the primary bottom navigation.

```text
┌──────────────────────────────┐
│ Drafting Assistant      ● On │
│                              │
│ ┃ Current task               │
│ ┃ context / result / action  │
│ ┃                            │
│ │ editable draft             │
│ │                    [Copy]  │
│                              │
├──────────────────────────────┤
│ Drafts   Discover   Settings │
└──────────────────────────────┘
```

### Setup

Setup uses a narrow progress rail and a single content column. The six implementation steps are visually grouped into three phases: **Access** (boundaries + LinkedIn), **Drafting** (Gemini + profile + preferences), and **Ideas** (optional discovery). This shortens the perceived workflow without removing an existing decision.

The setup identity header remains fixed at the top while the page scrolls. The desktop progress rail sticks below that header so navigation and content never overlap.

```text
┌────────────────────────────────────────────┐
│ Drafting Assistant                 2 of 6  │
├───────────────┬────────────────────────────┤
│ ACCESS        │ ┃ Grant LinkedIn access    │
│  ✓ Boundaries │ ┃ concise explanation      │
│  ● LinkedIn   │ ┃ [permission row]          │
│ DRAFTING      │ ┃                           │
│  ○ Connection │ ┃ [Back]      [Continue]   │
│  ○ Profile    │ ┃                           │
│  ○ Preferences│ ┃                           │
│ IDEAS         │ ┃                           │
│  ○ Discovery  │ ┃                           │
└───────────────┴────────────────────────────┘
```

On small screens, the rail becomes a compact horizontal progress header while the content remains one column.

## Components

### Buttons

- **Primary:** Harbor Blue background, light label. One per decision area.
- **Secondary:** white background, rule border, ink label.
- **Quiet:** text-only, used for low-risk auxiliary actions.
- **Danger:** quiet red text or a white surface with a red border. Never competes with the primary action.
- Labels use direct verbs: `Continue`, `Copy draft`, `Run discovery`, `Save changes`, `Remove`.

### Working surface

A white surface with a subtle rule border. The active surface receives the proofing rail; passive surfaces do not. Nested cards are avoided—use dividers and spacing inside one surface.

### Fields

White or near-white background, 1 px rule border, 8 px radius. Labels sit above controls. Help text appears only when it prevents an error or clarifies data handling. Focus uses a 2 px proof outline plus a white offset.

Checkboxes use one 16 px square control throughout the extension. Checked controls use Harbor Blue with a white checkmark; browser-default accent colors are not used. When the entire row is selectable, its checked state uses the quiet proof tint and border in addition to the checkbox, never instead of it.

### Provider connection

Gemini and Groq credential fields share one `ApiKeyGuide` disclosure directly after the security hint. It uses three provider-specific steps and one official-console link; screens must not recreate this guidance independently. Device retention uses the same checkbox label for both providers and remains automatic—no extra vault setup form is introduced. A failed automatic unlock shows one warning with the single recovery action: paste a replacement key.

### Status

Use a dot plus a short label (`Ready`, `Running`, `Connected`, `Needs setup`). Status is not a decorative badge. Success, warning, and error messages state the outcome first and the next action second.

### Navigation

Use three top-level destinations: **Draft**, **Discover**, and **Settings**. Draft history belongs inside Draft because it is the same object lifecycle, not a separate product area. Onboarding navigation may still expose individual steps because users need to revisit a specific permission or preference.

### Draft choices

Strategy names become plain tabs or segmented choices above one editor. Only one editable draft is expanded at a time; this removes repeated textareas and repeated copy actions while preserving all four generated directions: Add insight, Ask a question, Build on it, and Challenge it. Challenge it is last because constructive disagreement carries the highest conversational risk.

### Disclosure

Use native `details` for optional settings and long evidence. The summary names the thing controlled and includes one short current-value description. Decorative eyebrows are omitted.

## Motion and accessibility

- One 160 ms fade-and-rise transition when the main view or selected draft changes.
- Buttons may change background or border; they do not float upward.
- Respect `prefers-reduced-motion` and remove all nonessential animation.
- Maintain a 4.5:1 contrast ratio for normal text.
- All interactive elements keep visible keyboard focus and a minimum 40 px target unless explicitly compact.
- Do not communicate active, success, warning, or error state by color alone.

## Content rules

- Start with the outcome or next action.
- Remove slogans, mood-setting copy, and repeated reassurance.
- Keep privacy statements at the exact decision point where data or access changes.
- Avoid phrases such as “thoughtful by design,” “when you’re ready,” and “make every reply feel considered”; they do not help someone complete the task.
- Use consistent nouns: `draft`, `post idea`, `profile`, `connection`, `source`, `history`.

## Design critique checkpoint

An earlier direction leaned toward blue gradients, pill badges, large rounded cards, and many promotional eyebrows. That visual language could belong to almost any AI extension and made a narrow utility feel like a landing page. The revised system removes gradients and default-blue accents, reduces radii and shadows, groups the six setup steps into meaningful phases, and spends its distinctiveness on the stateful proofing rail. Every remaining visual device now communicates task, hierarchy, or state.
