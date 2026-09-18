# MiawRouter Dashboard Navy Console Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply one blue Hybrid theme and coherent card/layout system across all MiawRouter dashboard route families without changing behavior.

**Architecture:** Improve shared tokens and components first, then prove the system on Providers, Endpoint, Usage, and Combos. Reuse those primitives across route families with minimal page-local edits. Preserve all data fetching, forms, API calls, navigation, and existing user changes.

**Tech Stack:** Next.js App Router, React client components, Tailwind CSS v4, CSS custom properties, Material Symbols, Vitest, ESLint.

## Global Constraints

- Dark mode leads with Navy Console; light mode remains complete and follows the same hierarchy.
- Initial theme follows the operating-system preference through the existing theme mechanism.
- Blue is the only accent; no orange sidebar treatment, purple gradient, decorative glow, colored left stripe, or fake status.
- Data-heavy pages use controlled density on desktop and reflow/contain on mobile.
- Every data view has loading, empty, error, and populated states; running pages also show running/completed states.
- All existing routes, APIs, data, forms, and workflows remain functional.
- Every interaction is keyboard accessible, focus-visible, and mobile targets are at least 44px.
- No new dependency or icon library.

---

### Task 1: Establish shared theme and surface tokens

**Files:**
- Modify: `src/app/globals.css`
- Inspect: `src/shared/components/ThemeProvider.js`, `src/shared/components/ThemeToggle.js`
- Test: `tests/unit/dashboard-navy-console.test.js`

**Interfaces:**
- Consumes: current CSS variables and existing `.dark` theme class.
- Produces: stable navy dark surfaces, cool light surfaces, blue accent, radius/shadow/density tokens.

- [ ] Add focused tests asserting both `:root` and `.dark` define sidebar, surface, page-ground, text, border, primary, focus, radius, and elevation variables.
- [ ] Run the focused test to confirm the new contract fails before changes.
- [ ] Reconcile duplicate legacy tokens so shared classes resolve to the same Hybrid palette in both themes.
- [ ] Keep the theme provider's system preference and persistence behavior unchanged; only adjust visual token values if required.
- [ ] Add reduced-motion handling for shared transitions.
- [ ] Run the focused test and `git diff --check`.

### Task 2: Upgrade shared Card and state primitives

**Files:**
- Modify: `src/shared/components/Card.js`
- Inspect/modify only if existing APIs require it: `src/shared/components/CardSkeleton.js`, `src/shared/components/EmptyState.js`, `src/shared/components/ErrorState.js`
- Test: `tests/unit/dashboard-navy-console.test.js`

**Interfaces:**
- Consumes: existing Card props (`title`, `subtitle`, `icon`, `action`, `padding`, `hover`, `elev`).
- Produces: backward-compatible semantic variants and consistent card headers/rows.

- [ ] Add tests that existing Card props still render and optional semantic variants do not remove children or actions.
- [ ] Refine Card defaults to use the new surface, border, radius, and shadow tokens.
- [ ] Add an optional `variant` prop with `default`, `metric`, `section`, `interactive`, and `danger`, keeping all current usages valid.
- [ ] Add visible focus styling only where Card is rendered as an actual interactive element; do not make static cards clickable.
- [ ] Ensure empty/loading/error components state cause and next action without inventing data.
- [ ] Run Card and state tests.

### Task 3: Standardize dashboard shell and page header

**Files:**
- Modify: `src/shared/components/Header.js`
- Modify: `src/shared/components/layouts/DashboardLayout.js`
- Modify: `src/shared/components/Sidebar.js`
- Modify: `src/app/globals.css`
- Test: `tests/unit/dashboard-navy-console.test.js`, existing sidebar tests

**Interfaces:**
- Consumes: route metadata, breadcrumbs, theme toggle, header search, sidebar drawer state.
- Produces: consistent shell spacing, Navy Console navigation, real breadcrumbs, mobile drawer behavior.

- [ ] Add tests for real `aria-current`, disclosure state, Escape drawer close, and no dead breadcrumb links.
- [ ] Apply the approved sidebar redesign without changing route arrays or update modal behavior.
- [ ] Align Header spacing, search, theme, language, and account actions to the shared surface system.
- [ ] Ensure mobile menu has an accessible name, 44px target, overlay close, and Escape close.
- [ ] Remove only decorative shell treatment that conflicts with Navy Console; preserve functional signal/status rails where they convey real state.
- [ ] Run sidebar and shell tests.

### Task 4: Create shared PageHeader, SectionHeader, StatusBadge, and DataTable patterns

**Files:**
- Create only if no existing equivalent is suitable: `src/shared/components/PageHeader.js`, `SectionHeader.js`, `StatusBadge.js`, `DataTable.js`
- Modify: `src/shared/components/index.js` if exports are needed
- Test: `tests/unit/dashboard-navy-console.test.js`

**Interfaces:**
- Consumes: page title, description, optional icon, actions, filters, table columns/rows, status text.
- Produces: reusable accessible primitives with explicit loading/empty/error support.

- [ ] Search existing shared components before creating each file; reuse instead of duplicating.
- [ ] Add tests for heading semantics, button/link behavior, status text paired with state, and table mobile containment.
- [ ] Implement only the minimum API needed by the four reference pages.
- [ ] Ensure page headers use sentence case and do not introduce fictional metrics or labels.
- [ ] Run focused component tests.

### Task 5: Redesign Providers directory and provider detail surfaces

**Files:**
- Modify: `src/app/(dashboard)/dashboard/providers/page.js`
- Modify as needed: `src/app/(dashboard)/dashboard/providers/[id]/page.js`
- Modify as needed: `src/app/(dashboard)/dashboard/providers/components/ConnectionsCard.js`, `ModelsCard.js`, `OpenCodeZenPanel.js`
- Test: existing provider tests plus `tests/unit/dashboard-navy-console.test.js`

**Interfaces:**
- Consumes: existing provider fetching, filters, connections, models, and provider actions.
- Produces: directory-first layout, controlled card hierarchy, clear connection states.

- [ ] Preserve provider selection, search/filter, add-provider, connection testing, and model actions.
- [ ] Replace equal-weight decorative cards with directory/list focus and compact real summaries.
- [ ] Apply the shared PageHeader/Card/Status patterns.
- [ ] Verify loading, empty, error, and populated provider states.
- [ ] Run provider-focused tests.

### Task 6: Redesign Endpoint, Usage + Cache, and Combos reference pages

**Files:**
- Modify: `src/app/(dashboard)/dashboard/endpoint/**`
- Modify: `src/app/(dashboard)/dashboard/usage/**`
- Modify: `src/app/(dashboard)/dashboard/combos/**`
- Test: existing endpoint, usage, combo tests plus focused dashboard tests

**Interfaces:**
- Consumes: existing API key, endpoint, usage, cache, combo, vision adapter, and chart/table logic.
- Produces: four reference compositions that define the rest of the dashboard system.

- [ ] Preserve copy actions, key management, tabs, filters, chart data, table actions, combo ordering, and vision adapter behavior.
- [ ] Use controlled-density metrics and tables on desktop; stack controls and contain wide content on mobile.
- [ ] Ensure every chart has a real data-driven title and every empty/error state offers a next action.
- [ ] Apply `metric`, `section`, and `interactive` card variants only where their semantic role is real.
- [ ] Run the reference-page tests and production build.

### Task 7: Apply patterns to monitoring and configuration routes

**Files:**
- Modify: `src/app/(dashboard)/dashboard/health/**`
- Modify: `runtime/**`, `quota/**`, `provider-stats/**`, `activity/**`, `logs/**`, `costs/**`
- Modify: `free-tiers/**`, `privacy/**`, `token-saver/**`, `settings/**`, `cache/**`, `guardrails/**`
- Test: route-specific existing tests and focused dashboard tests

**Interfaces:**
- Consumes: each page's existing data and action contracts.
- Produces: consistent operational and configuration hierarchy.

- [ ] Apply shared page/section/card/status patterns without flattening page-specific workflows.
- [ ] Preserve real metrics and remove no data because of visual restructuring.
- [ ] Verify empty/loading/error states and destructive-action boundaries.
- [ ] Run route-specific tests.

### Task 8: Apply patterns to workbench, integration, agent, and media routes

**Files:**
- Modify: `playground/**`, `basic-chat/**`, `translator/**`, `mitm/**`, `mcp/**`, `a2a/**`, `batch/**`, `webhooks/**`, `api-endpoints/**`
- Modify: `cloud-agents/**`, `agent-skills/**`, `discovery/**`, `skill-discovery/**`, `skills/**`
- Modify: `media-providers/**`, `cli-tools/**`, `pxpipe/**`, `memory/**`, `console-log/**`
- Test: existing route-specific tests and focused dashboard tests

**Interfaces:**
- Consumes: existing workbench controls, forms, streaming views, integrations, tool cards, agent data, and media provider data.
- Produces: work-surface-first layouts with shared visual language.

- [ ] Keep work surfaces dominant and configuration secondary.
- [ ] Preserve form submission, streaming, refresh, copy, modal, and action behavior.
- [ ] Adapt tool/agent/media card grids to controlled hierarchy rather than identical decorative cards.
- [ ] Verify mobile reflow and state completeness.
- [ ] Run route-specific tests.

### Task 9: Full visual, accessibility, and regression verification

**Files:**
- Modify only scoped UI files when verification finds a defect.

- [ ] Run focused dashboard tests and the complete test suite.
- [ ] Run `npm run lint`; require zero errors.
- [ ] Run `npm run build`; require success.
- [ ] Verify theme follows system preference on first load and manual theme selection persists.
- [ ] Browser-check representative pages in dark and light mode at desktop, tablet, and narrow mobile widths.
- [ ] Keyboard-check sidebar, header, filters, tabs, tables, dialogs, copy actions, and primary page actions.
- [ ] Run contrast checks for normal text and focus/component boundaries.
- [ ] Run `git diff --check` and review the final diff for route/API/data changes and unrelated churn.
