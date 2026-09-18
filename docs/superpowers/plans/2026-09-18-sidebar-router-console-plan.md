# MiawRouter Sidebar Router Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the dashboard sidebar as a blue Router Console combining compact workbench density with calm dashboard hierarchy.

**Architecture:** Preserve `Sidebar.js`, its route arrays, update flow, and conditional entries. Make focused semantic changes in the component and mobile layout, then replace the old sidebar styling through existing hooks in `globals.css`. No dependency or route changes.

**Tech Stack:** Next.js App Router, React client components, Tailwind utilities, CSS custom properties, Material Symbols, Vitest, ESLint.

## Global Constraints

- Blue is the only accent; no orange sidebar treatment.
- Preserve routes, update behavior, Translator condition, light/dark themes, and mobile drawer.
- No gradient, glow, decorative left stripe, excessive pills, or invented status.
- Active routes expose `aria-current`; disclosures expose state; focus remains visible.
- Mobile controls are at least 44px and Escape closes the drawer.
- Preserve all unrelated uncommitted work.

---

### Task 1: Pin behavior with tests

**Files:**
- Create: `tests/unit/sidebar-router-console.test.js`

**Interfaces:**
- Consumes: source of `Sidebar.js`, `DashboardLayout.js`, and `globals.css`.
- Produces: focused regression checks for semantics and removed legacy styling.

- [ ] Write failing source-level tests requiring `aria-current`, media `aria-expanded`/`aria-controls`, Escape handling, and no sidebar `border-left`/orange treatment.
- [ ] Run `cd tests && npx vitest run unit/sidebar-router-console.test.js`; expect failures before implementation.

### Task 2: Improve sidebar semantics and hierarchy

**Files:**
- Modify: `src/shared/components/Sidebar.js`

**Interfaces:**
- Consumes: existing nav arrays, pathname matching, update state, and `onClose`.
- Produces: unchanged destinations with accessible links and disclosure controls.

- [ ] Add `aria-current={active ? "page" : undefined}` to navigable items.
- [ ] Add `type`, `aria-expanded`, `aria-controls`, and label to Media Providers disclosure; add matching content id.
- [ ] Keep sections collapsible and initialize the section containing the current route open.
- [ ] Preserve all existing links, update behavior, and conditional Translator visibility.
- [ ] Run focused sidebar tests; expect PASS.

### Task 3: Build blue Router Console visual system

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/shared/components/Sidebar.js` for class hooks only

**Interfaces:**
- Consumes: existing theme variables and sidebar class hooks.
- Produces: grounded navy/cool-neutral shell with blue current/focus state.

- [ ] Replace colored left stripe and brand gradient with structural spacing and neutral borders.
- [ ] Style active route with a restrained blue surface, readable text/icon, and small geometric marker.
- [ ] Keep resting and hover states calm; add explicit `:focus-visible` styles.
- [ ] Reduce uppercase tracking in section labels and preserve compact density.
- [ ] Add narrow-screen 44px targets and reduced-motion rules.
- [ ] Verify key color pairs with `/home/fajar/.agents/skills/antislop-human/contrast-check.py`; text needs 4.5:1, focus/non-text needs 3:1.

### Task 4: Complete mobile drawer behavior

**Files:**
- Modify: `src/shared/components/layouts/DashboardLayout.js`

**Interfaces:**
- Consumes: existing `sidebarOpen`, overlay, Header menu callback, and Sidebar close callback.
- Produces: labeled drawer that closes by route selection, overlay click, and Escape.

- [ ] Add a cleanup-safe Escape listener while the drawer is open.
- [ ] Add navigation/dialog semantics and accessible labeling without duplicating the sidebar tree.
- [ ] Preserve mobile transform behavior and prevent overflow.
- [ ] Run focused tests and `npm run build`; expect PASS.

### Task 5: Verify and review

**Files:**
- Modify only scoped sidebar files if verification reveals a defect.

- [ ] Run sidebar tests plus existing discovery and Soon audits.
- [ ] Run `npm run lint`; require 0 errors.
- [ ] Run `npm run build`; require success.
- [ ] Browser-check desktop/mobile and light/dark themes; exercise section toggles, route state, keyboard focus, overlay click, and Escape.
- [ ] Run `git diff --check` and inspect only sidebar-related diffs; do not alter unrelated provider work.
