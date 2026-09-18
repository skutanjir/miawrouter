# MiawRouter Dashboard Navy Console Redesign

## Design read

Operational dashboard for developers managing an AI routing gateway, using a Navy Console visual language. Dial: ENERGY 2 / RHYTHM 2 / MOTION 1.

## Goal

Give all dashboard routes one recognizably MiawRouter visual system while preserving every route, API, workflow, state transition, theme toggle, and existing user setting.

## Theme direction

Dark mode is the visual lead: navy page ground, slightly lighter navy panels, cool borders, high-contrast text, and one blue accent. Blue is reserved for primary actions, focus, current navigation, and informative state.

Light mode remains complete. It uses cool blue-grey ground and white panels while preserving the same hierarchy, spacing, component proportions, and behavior. Initial theme follows the operating-system preference. Explicit user choice remains persistent through the current theme mechanism.

No purple gradient, orange brand treatment, decorative glow, colored left stripe, excessive pill shapes, fake terminal decoration, invented metrics, or fabricated status.

## Density and responsiveness

Data-heavy pages use controlled density on desktop. Tables, filters, and metrics remain compact enough to scan. Tablet and mobile layouts stack controls, increase touch targets to at least 44px, and contain wide data regions without page-level horizontal overflow.

Every interactive component has a visible focus state. Motion is limited to disclosures, drawers, and state transitions; reduced-motion preferences disable nonessential transitions.

## Page families

### Directory

Providers, CLI Tools, Agent pages, Skills, and Media Providers.

- Search and filters lead the page.
- Real operational summaries remain compact.
- The directory/list is the focal point, not decorative metric cards.
- Empty, loading, and error states explain the next action.

### Operations

Endpoint, Runtime, Health, Cache, and Proxy Pools.

- Current operational state leads.
- Configuration and diagnostics follow in decision order.
- Copyable values use a restrained utility/monospace treatment.

### Analytics

Usage, Quota, Provider Stats, Activity, Logs, and Costs.

- Metrics answer real questions and use real data only.
- Charts have specific titles and decision value.
- Tables remain dense on desktop and become contained/reflowed on mobile.

### Configuration

Combo, Privacy, Token Saver, Feature Flags, Guardrails, and Settings.

- Controls are grouped by the decision users make.
- Section hierarchy replaces repetitive equal-weight cards.
- Risky actions remain clearly separated and labelled.

### Workbench

Playground, Basic Chat, Translator, MITM, MCP, A2A, Batch, Webhooks, and API Endpoints.

- The working surface is dominant.
- Configuration and references remain secondary.
- Empty, loading, running, success, and error states are explicit.

## Shared component system

### Dashboard shell

- Navy Console sidebar and grounded top header.
- Consistent page width and responsive padding.
- Page headings do not compete with duplicate in-page headings.
- Breadcrumbs represent real destinations only.

### Card

The shared Card supports semantic visual roles without adding a new component for every page:

- `default`: ordinary content container.
- `metric`: compact real-data summary.
- `section`: grouped configuration or operational content.
- `interactive`: real clickable destination/control with hover and focus states.
- `danger`: destructive or high-risk action area.

Cards stay mostly flat. Elevation is reserved for overlays and explicitly elevated content.

### Page and section headers

A shared PageHeader standardizes heading, plain description, primary action, optional refresh, and bounded filters. Shared SectionHeader standardizes internal hierarchy. Existing route-specific controls remain functional.

### Data and status components

- DataTable: controlled density, readable header, row hover/focus, contained mobile overflow.
- StatusBadge: text plus color; no color-only meaning.
- EmptyState: why it is empty and the action that fills it.
- LoadingState: what is loading.
- ErrorState: what failed and the available recovery action.

### Controls

Buttons, inputs, selects, tabs, segmented controls, drawers, and modals use the same navy/light surfaces, blue focus ring, radius scale, and state language. Existing component APIs are preserved unless a backward-compatible optional prop is required.

## Priority reference pages

The system is proven first on four representative routes:

1. Providers: directory and connection state.
2. Endpoint & API Key: operations and copyable configuration.
3. Usage + Cache: analytics and controlled data density.
4. Combo & Vision Adapter: configuration and routing hierarchy.

These pages establish patterns for the remaining route families. Later pages reuse the resulting shared components instead of receiving unrelated custom styling.

## Accessibility

- WCAG AA contrast: 4.5:1 for normal text; 3:1 for large text and component boundaries.
- Keyboard access for all controls and visible focus in both themes.
- Current navigation uses `aria-current`; disclosures expose expanded state.
- Dialogs/drawers close with Escape and preserve usable focus behavior.
- Mobile controls have at least 44px targets.
- No information is conveyed only by hue.

## State completeness

Every data view must represent loading, empty, error, and populated states. Pages that run work also represent running and completed states. Existing real messages remain the source of truth; redesign does not invent product data or claims.

## Scope and rollout

Implementation is phased:

1. Foundation: theme tokens, shared Card/control system, shell, shared headers, and states.
2. Reference pages: Providers, Endpoint, Usage, Combo.
3. Monitoring and configuration routes.
4. Tools and integration routes.
5. Agent and media routes.
6. Full visual, accessibility, responsive, and regression verification.

Each phase must pass focused tests, lint with zero errors, and a production build before the next phase. Existing unrelated local changes are preserved and reviewed separately.

## Non-goals

- No routing, API, provider, credential, database, or business-logic changes.
- No new design dependency or icon library.
- No route removal or fake replacement content.
- No page rewrite solely to enforce visual uniformity when the page's real task needs a different composition.
