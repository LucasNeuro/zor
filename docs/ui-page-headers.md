# CRM page headers (sticky pattern)

## Goal

Keep the **page title** and **primary actions** visible while long content scrolls. Match Obra10 surfaces (`#0d1117`, `#161b22`, gold `#c9a24a`, green accents).

## Layout shell (`app/crm/layout.tsx`)

- The main column is a **flex column** with `min-h-0` / `flex-1` so children can shrink.
- The **`{children}`** region is a **scrollport**: `flex flex-1 min-h-0 flex-col overflow-y-auto` (plus bottom safe-area padding on mobile).
- **Sticky headers** inside routes use `position: sticky; top: 0` relative to this scrollport, so they pin under the scroll area’s top edge (below the mobile CRM bar on small screens).

## Shared component

- `components/crm/CrmStickyPageHeader.tsx` — title, optional description, optional `actions` slot.
- Surface: `#161b22` with blur, subtle bottom gold hairline, border `#30363d`.

## Full-height pages (e.g. Pipeline)

- Route root: `flex flex-1 min-h-0 flex-col overflow-hidden` so the column **fills** the layout’s scroll slot and **inner** regions (`flex-1 min-h-0 overflow-*`) handle Kanban/list scrolling — avoids relying on `h-screen`, which fights the shell.

## Mobile

- Toolbars stack vertically (`gap-2`), controls use **`min-h-11`** where appropriate for touch.
- Safe area: CRM mobile top bar uses `padding-top: max(0.5rem, env(safe-area-inset-top))`.

## References

- KPIs: `app/crm/kpis/page.tsx`
- Leads: `app/crm/leads/page.tsx`
