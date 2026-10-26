---
color.primary: "#2C4A3E"
color.primaryHover: "#1F352C"
color.heroBackground: "#14221C"
color.heroSurface: "#1C2F27"
color.heroAccentBrass: "#DFB77C"
color.secondary: "#7A4B2A"
color.surface: "#FAF8F5"
color.surfaceElevated: "#FFFFFF"
color.surfaceSunken: "#EAE5DD"
color.background: "#F3EFEA"
color.text: "#1C1B19"
color.textMuted: "#57534E"
color.border: "#DCD6CD"
color.borderStrong: "#C5BEB3"
color.error: "#A82424"
color.warning: "#9C5700"
color.warningSurface: "#FFF5E6"
color.success: "#23633D"
color.successSurface: "#EBF5EE"
type.display.fontFamily: "'Newsreader', 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif"
type.display.fontSize: 22px
type.display.fontWeight: 600
type.display.lineHeight: 1.25
type.headline.fontFamily: "'Newsreader', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif"
type.headline.fontSize: 17px
type.headline.fontWeight: 600
type.headline.lineHeight: 1.3
type.body.fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
type.body.fontSize: 14px
type.body.fontWeight: 400
type.body.lineHeight: 1.5
type.mono.fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
type.mono.fontSize: 12px
type.mono.fontWeight: 500
type.mono.lineHeight: 1.45
spacing.unit: 8px
radius.xs: 4px
radius.sm: 6px
radius.md: 10px
radius.lg: 14px
shadow.sm: "0 1px 0 rgba(255, 255, 255, 0.85) inset, 0 1px 3px rgba(28, 27, 25, 0.06)"
shadow.md: "0 8px 24px rgba(28, 27, 25, 0.12), 0 2px 6px rgba(28, 27, 25, 0.06)"
---

## Overview

The interface takes its visual cues from a 1970s test-kitchen reference card catalog, an editorial *NYT Cooking* special issue, and the tabular process sheets of *Cooking for Engineers*. Warm stone parchment surfaces (`#F3EFEA`) hold cream index cards (`#FAF8F5`), high-contrast charcoal ink (`#1C1B19`), serif dish titles, and tabular-numeral data columns. The dedicated **Atelier Front Page (`0. Home / Atelier`)** opens with a deep chiaroscuro herb-slate Hero (`#14221C`) accented with burnished brass (`#DFB77C`) and overhead editorial food photography, drawing users directly into an interactive live pairing lab, chef collection showcases, and 1-click workbench launches without generic SaaS decoration.

## Colors

- `color.background` (`#F3EFEA`) forms the outer workbench desk surface.
- `color.surface` (`#FAF8F5`) defines primary section cards with a subtle top inset highlight.
- `color.surfaceElevated` (`#FFFFFF`) separates interactive ingredient rows, recipe cards, and popovers from card backgrounds.
- `color.surfaceSunken` (`#EAE5DD`) frames segmented control tracks, filter wells, and flavor meter tracks.
- `color.heroBackground` (`#14221C`) and `color.heroAccentBrass` (`#DFB77C`) anchor the Home / Atelier Hero banner and final conversion callout with warm editorial contrast.
- `color.primary` (`#2C4A3E`, deep herb slate) marks primary actions, active navigation states, and high-affinity pairings.
- `color.secondary` (`#7A4B2A`, roasted umber) highlights culinary techniques, regional traditions, and stage transitions.
- `color.warning` (`#9C5700`) and `color.error` (`#A82424`) pair with explicit text prefixes (`[!]` and `[X]`) to flag conditional or conflicting pairings without relying on hue alone.
- `color.success` (`#23633D`) marks verified harmonious pairings, completed cooking steps, and active bridge rescues.

## Typography

- `type.display` and `type.headline` use an editorial serif stack (`Newsreader`, `Iowan Old Style`, `Georgia`) for Hero headlines, application headers, dish titles, and recipe titles.
- `type.body` uses a clean humanist sans-serif (`Inter`, `system-ui`) at a 14px floor for controls, rationales, and step instructions.
- `type.mono` applies `font-variant-numeric: tabular-nums` across weights, compatibility scores, nutrition tables, and exported AI prompts so numbers align vertically down columns.

## Layout

The layout scales from an 8px spacing unit inside a 1480px container:

- **Home / Atelier View:** Uses four distinct, non-repetitive section structures: (1) an asymmetric chiaroscuro Hero (`1.12fr 0.88fr`) with live anchor ingredient pills, (2) a two-column interactive Bento Pairing Lab (`0.88fr 1.12fr`), (3) an editorial spread pairing a featured plate card with chef signature rows, and (4) a 4-stage numbered architectural workflow strip.
- **Desktop Workbench (`1024px+`):** Single-line 7-tab navigation bar above a two-column asymmetric workbench grid (`minmax(0, 1fr) minmax(0, 1.06fr)`).
- **Tablet & Mobile (`<980px`):** Columns stack into a single vertical flow; horizontal tables (such as the *Cooking for Engineers* matrix) keep sticky left ingredient columns inside an overflow container.

## Elevation & Depth

- Base cards sit at `z-index: 1` with `shadow.sm` and `1px solid #DCD6CD` hairlines.
- Sticky table columns in the process matrix sit at `z-index: 5`.
- Autocomplete combobox popovers sit at `z-index: 60` with `shadow.md`.
- Floating kitchen timers and live status toasts sit at `z-index: 90` with `shadow.md`.

## Shapes

Corner radii scale by component hierarchy rather than sharing one flat value:

- `4px` (`radius.xs`) for inline status badges, keyboard shortcut caps (`<kbd>`), and flavor tags.
- `6px` (`radius.sm`) for buttons, form inputs, select menus, and segmented control pills.
- `10px` (`radius.md`) for primary workbench cards and recipe containers.
- `14px` (`radius.lg`) for the Home Hero banner, elevated autocomplete popovers, and floating timer banners.

## Components

### Atelier Hero & Interactive Bento Spotlight

- The Hero pairs a single primary brass CTA (`Launch Dish Workbench →`) with secondary outline triggers and live anchor ingredient pills (`Duck Breast`, `Salmon Fillet`, `Sea Scallops`, `White Miso`, `Sichuan Peppercorn`, `Cod / Halibut`, `Wild Mushrooms`, `Dark Chocolate`).
- Selecting any anchor pill re-evaluates the ingredient live through `CulinaryEngine`, updating the Botanical Specimen Dossier and Top 5 Affinity Matrix in place.

### Buttons & Segmented Controls

- Buttons use `6px` radius, `1px solid` borders, `cubic-bezier(0.16, 1, 0.3, 1)` hover transitions, and active press feedback (`scale(0.985)`).
- Disabled buttons (`:disabled`) drop to `0.42` opacity with `cursor: not-allowed` and sunken fill (`#F4F2EE`).
- Segmented controls group related view/unit/yield options inside a sunken `#EAE5DD` track so sibling options stay on a single line.

### Cards & Ingredient Rows

- Primary cards use `#FAF8F5` backgrounds, `10px` radius, and `16px` padding.
- Interactive rows (`.selected-item-row`, `.rec-card`, `.recipe-card-item`) use `#FFFFFF` fill and shift border color to `#2C4A3E` on hover.

### Inputs, Search & Combobox

- Search inputs include an inline `<kbd>/</kbd>` shortcut badge when empty and a 1-click `[×]` clear button when populated.
- Select elements use custom inline SVG carets with `28px` right padding for consistent cross-browser rendering.

### Process Matrix (`Cooking for Engineers`)

- Left `Amount` and `Ingredient` columns stay pinned (`position: sticky; left: 0`) during horizontal stage scrolling.
- Stage action cells support 1-click completion toggling (`[✓] Done`) and row/stage hover highlighting.

## Do's and Don'ts

- Do: Pair every color-coded status indicator with an explicit text label (`[Strong]`, `[Challenging — Override Available]`, `[✓] Completed`).
- Do: Use distinct information structures across landing page sections and ground every metric in real repository data.
- Don't: Use blue-to-purple SaaS gradients, glowing neon orbs, fabricated user testimonials, or dead placeholder links.
- Don't: Trigger full-DOM re-renders when displaying transient toast notifications or ticking countdown timers.
- Don't: Use native blocking `alert()`, `confirm()`, or `prompt()` dialogs.
