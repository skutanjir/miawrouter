# MiawRouter Blue Branding Design

## Goal

Replace the remaining orange/legacy MiawRouter visual identity with the blue cat-router identity shown in the supplied reference image. Keep the product name and functional navigation semantics unchanged.

## Scope

- Replace the shared `brand-*`, primary, signal, focus, selection, and shadow tokens in `src/app/globals.css` with a blue/navy palette.
- Update the sidebar brand mark to use the cat-router asset instead of the `hub` Material icon.
- Use one canonical cat-router asset for favicon, app metadata, manifest/PWA icons, and sidebar branding.
- Update light and dark theme surfaces so both remain readable and clearly belong to the same blue visual system.
- Leave feature-specific status colors (success, warning, danger, provider states) intact unless they are directly part of the old brand accent.

## Visual system

- Electric blue `#168BFF`: primary actions, active navigation, focus, and live signal.
- Royal blue `#174A9E`: hover states, secondary brand depth, and gradients.
- Cool white `#F7FAFF`: light surfaces and high-contrast text.
- Navy `#0C1524`: dark page/sidebar foundation.
- Blue slate `#16243A`: dark cards, borders, and secondary surfaces.
- Soft blue glow: replace warm/orange shadows with restrained blue shadows.

The blue accent is the memorable element. The rest of the UI stays quiet enough that charts, provider statuses, and operational data remain legible.

## Asset strategy

Use the supplied image as the source reference and create/reuse a compact canonical cat-router icon asset suitable for small sizes. Point all app-level icon consumers at that asset rather than maintaining separate legacy variants. Do not replace provider logos or functional Material icons; only application-brand icons are in scope.

## Implementation shape

1. Centralize color changes in the existing CSS custom properties so existing `brand-*` consumers inherit the new identity.
2. Replace the sidebar's static brand glyph with the canonical asset while preserving the existing link and accessible product name.
3. Align document metadata, manifest colors, and PWA icon paths with the same asset and navy theme.
4. Run existing branding/assets checks plus a production lint/build-oriented check appropriate to the repository.

## Acceptance criteria

- No application-level brand token uses the old orange accent.
- Sidebar displays the cat-router mark and remains usable at its current width.
- Favicon, browser metadata, and installed PWA metadata use the blue cat-router identity.
- Light and dark themes both render with blue brand accents and readable contrast.
- Existing provider/status colors and unrelated user changes are not rewritten.
- Existing branding and standalone-asset tests pass.

## Deliberate simplifications

- Keep Material Symbols for navigation semantics; replacing every feature icon with the logo would reduce scanability.
- Keep the current theme toggle and `system` behavior; only its palette changes.
- Avoid a broad page-by-page redesign because shared tokens already cover the application and keep the diff safer.
