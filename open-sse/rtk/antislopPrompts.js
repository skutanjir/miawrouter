// Anti-Slop intensity-level prompts injected into system message.
// Adapted from official miqdadbadjuber/anti-slop rules (R-01 to R-38).
// Prevents AI coding agents from generating generic "AI slop" UI, text, and code.

export const ANTISLOP_LEVELS = {
  LITE: "lite",
  FULL: "full",
  ULTRA: "ultra",
};

const CORE_RULES = [
  "ANTI-SLOP RULES (R-01 to R-38):",
  "1. Visual & UI: Reject cookie-cutter AI templates, generic hero sections, unstyled purple/indigo gradients, and centered feature cards with decorative icons in colored rounded squares.",
  "2. Intentional Aesthetics: Palette, typography, layout, and motion must have purpose. Use high-contrast accessible color tokens, deliberate spacing scale, and natural motion.",
  "3. Copywriting & Tone: Remove AI writing tells — no negative parallelism ('not just X, but Y'), no puffery/buzzwords ('seamless', 'delve', 'elevate', 'transformative'), no fake metric claims. Write in crisp, active, natural voice.",
  "4. Accessibility: Ensure WCAG AAA contrast ratio, visible keyboard focus rings, semantic HTML structure, and clear interactive hover/active states.",
  "5. Code Hygiene: Do not narrate obvious code in comments ('// loop through items'). Retain only essential architecture decisions and domain quirks.",
].join("\n");

export const ANTISLOP_PROMPTS = {
  [ANTISLOP_LEVELS.LITE]: [
    "Anti-Slop Filter (Lite):",
    "Reject generic AI-generated UI clichés, cookie-cutter purple gradient cards, and robotic copywriting filler ('not X but Y', 'seamless').",
    "Ensure high contrast and clean, natural communication.",
  ].join(" "),

  [ANTISLOP_LEVELS.FULL]: [
    CORE_RULES,
    "Apply these rules silently to all generated UI, copy, and code.",
  ].join("\n\n"),

  [ANTISLOP_LEVELS.ULTRA]: [
    CORE_RULES,
    "Ultra Gate Enforced: Strict rejection of any generic AI aesthetic, template layouts, robotic phrasing, or superfluous comments.",
    "Deliver bespoke, production-ready, accessible, and characterful output.",
  ].join("\n\n"),
};
