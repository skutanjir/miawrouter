# MiawRouter Sidebar Redesign

## Design read

Dashboard navigation for developers operating a local AI router, using a network-console visual language. Dial: ENERGY 2 / RHYTHM 2 / MOTION 1.

## Goal

Replace the remaining 9Router-like sidebar treatment with a recognizably MiawRouter navigation shell. Preserve every existing route, update flow, conditional Translator item, mobile drawer behavior, theme support, and current local work.

## Direction

Combine three qualities:

- **Router Console:** the sidebar reads as an operational network panel, with clear hierarchy and connection context.
- **Compact Workbench:** desktop navigation stays information-dense and fast to scan.
- **Calm Dashboard:** restrained surfaces and spacing prevent the large route set from becoming noisy.

Blue replaces orange as the sole brand accent. Dark navy is the structural base in dark mode; light mode uses cool neutral surfaces. No purple gradients, decorative glow, colored left stripe, excessive pills, or ornamental status claims.

## Structure

1. **Brand panel:** MiawRouter mark, product name, version, and a compact console descriptor. Update availability remains functional but visually secondary.
2. **Primary routes:** Core routes stay immediately visible and receive the strongest hierarchy.
3. **Grouped routes:** Analytics, Configuration, Tools, Integrations, and Agents remain collapsible. The section containing the current page opens automatically.
4. **System routes:** Media Providers remains a nested disclosure. Proxy, debugging routes, and Settings stay available without changing destinations.
5. **Mobile:** the same information architecture appears in a drawer. Existing overlay dismissal remains; controls use at least 44px touch targets.

## Visual system

- **Color:** navy structural surface, cool slate neutrals, one accessible blue accent. Blue indicates current route, keyboard focus, and real actionable state only.
- **Typography:** existing product type stack remains to avoid global churn. Weight and size establish hierarchy; monospace is limited to version/command data.
- **Active route:** a quiet blue surface, stronger text/icon contrast, and a small geometric route marker. No decorative left stripe.
- **Sections:** sentence-case headings with compact disclosure controls. Dividers are used only to separate information levels.
- **Depth:** mostly flat. Shadow is reserved for the mobile drawer and update overlay, where elevation is functional.
- **Motion:** short disclosure and drawer transitions only; reduced-motion preferences are respected.

## Interaction and accessibility

- Existing links remain real Next.js links.
- Disclosure buttons expose `aria-expanded`; the media disclosure also gains an accessible label.
- Active links expose `aria-current="page"`.
- Every interactive element has visible focus treatment in both themes.
- Current-route groups initialize open so users never land with their location hidden.
- Sidebar scrolling remains independent from page content.
- Mobile overlay becomes an actual dismiss control or receives equivalent keyboard-safe behavior; Escape closes the drawer.

## Scope

Expected implementation scope:

- `src/shared/components/Sidebar.js`
- `src/shared/components/layouts/DashboardLayout.js`
- `src/app/globals.css`
- focused sidebar tests

Do not change routes, page content, provider logic, data APIs, update behavior, or unrelated dashboard components.

## Verification

- Focused sidebar/navigation tests.
- ESLint for changed files or project lint if scoped lint is unavailable.
- Production build.
- Browser checks at desktop and narrow mobile widths in light and dark themes.
- Keyboard check: Tab order, disclosure activation, visible focus, mobile dismissal, Escape behavior.
