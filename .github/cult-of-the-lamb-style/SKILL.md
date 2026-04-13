# Cult of the Lamb — Visual Style Guide

---

name: cult-of-the-lamb-style
description: A strict visual design system for a Cult of the Lamb style game project. Parchment-dominant aesthetic — aged cream backgrounds, near-black ink, blood-red as sparingly used accent only.

---

Inspired by Massive Monster's _Cult of the Lamb_ (2022).
**Apply these rules to every UI component, screen, menu, button, form, card, modal, or any visual element you generate or modify.** Never deviate without explicit approval.

The aesthetic is: an aged grimoire or cult manuscript — warm parchment base, dark ink structure, and blood-red used only as deliberate accent marks. Think a hand-inked tome, not a dungeon. Deceptively cute-but-sinister through restraint, not darkness. This is NOT pixel art — it's illustrated, painted, hand-inked style.

---

## Color Palette

```css
:root {
  /* PRIMARY — dominant surfaces */
  --bg-parchment: #f0e8d0; /* Main background — aged paper */
  --bg-parchment-warm: #e8dab8; /* Slightly darker — cards, panels */
  --bg-parchment-deep: #d4c49a; /* Deepest cream — inset areas, HUD cells */

  /* STRUCTURE — text, borders, frames */
  --ink-void: #0d0a0e; /* Near-black — primary text, outer borders */
  --ink-dark: #1a1018; /* Deep ink — secondary text, dividers */
  --ink-mid: #2e2030; /* Mid ink — subtle borders, muted labels */
  --ink-faded: #4a3d50; /* Faded ink — placeholder, tertiary text */

  /* ACCENT — use sparingly, never as fill, only as mark */
  --red-blood: #6b0000; /* Deep blood — shadow accent on red elements */
  --red-bright: #cc1a1a; /* Bright blood — rune marks, corner accents, active state */

  /* SUPPORT — wood, earth, teal for structural detail only */
  --border-wood: #3d2b1a; /* Frame borders */
  --border-teal: #3d5c50; /* Teal frame accent */
  --gold: #a07820; /* Gold — only for key badges and titles */
}
```

### Hierarchy Rule

| Role             | Color                                  | Usage frequency     |
| ---------------- | -------------------------------------- | ------------------- |
| Background       | `--bg-parchment`                       | Always              |
| Panel / card     | `--bg-parchment-warm`                  | Common              |
| Inset / cell     | `--bg-parchment-deep`                  | Occasional          |
| Text (primary)   | `--ink-void`                           | Always              |
| Text (secondary) | `--ink-mid`                            | Common              |
| Borders / frames | `--ink-dark` or `--border-wood`        | Common              |
| Red accent       | `--red-bright` (line, dot, rune, mark) | Rare — details only |

**Red must never fill large areas.** Use it only for: corner rune marks, active-state underlines, thin rule lines between sections, and small decorative crosses or symbols.

---

## Typography

```html
<link
  href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=IM+Fell+English:ital@0;1&display=swap"
  rel="stylesheet"
/>
```

| Use case                        | Font                           | Color          |
| ------------------------------- | ------------------------------ | -------------- |
| Titles, names, large HUD labels | `'Cinzel', serif` — weight 700 | `--ink-void`   |
| Dialog, descriptions, body      | `'IM Fell English', serif`     | `--ink-dark`   |
| Stats, counters, small labels   | `'Cinzel', serif` — weight 400 | `--ink-mid`    |
| Section dividers, rune labels   | `'Cinzel', serif`              | `--red-bright` |

**Never use** sans-serif or monospace fonts.
All text gets: `text-shadow: 0 1px 0 rgba(255,255,255,0.4), 0 -1px 0 rgba(0,0,0,0.2);` — this lifts ink off parchment.

---

## Shapes & Borders

- `border-radius` max `3px` — nearly square, never pill/rounded.
- Outer frames use `--border-wood` or `--ink-dark`.
- Panels use `inset box-shadow` for a pressed-into-paper look.

```css
.panel {
  background: var(--bg-parchment-warm);
  border: 2px solid var(--border-wood);
  border-radius: 2px;
  box-shadow:
    inset 0 0 16px rgba(0, 0, 0, 0.12),
    0 3px 10px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(0, 0, 0, 0.08);
}
```

Corner decorations via pseudo-elements (use `--red-bright` for the corner rune marks):

```css
.panel::before {
  content: "✦";
  position: absolute;
  top: 4px;
  left: 6px;
  color: var(--red-bright);
  font-size: 10px;
  opacity: 0.7;
}
```

---

## Red Accent Usage — The Mark, Not the Canvas

Red must feel like a drop of blood on parchment — visible, meaningful, never overwhelming.

```css
/* Thin red rule between sections */
.section-divider {
  border: none;
  border-top: 1px solid var(--red-blood);
  opacity: 0.5;
  margin: 1rem 0;
}

/* Active state underline */
.tab.active {
  border-bottom: 2px solid var(--red-bright);
}

/* Faith / health bar fill — only the fill, not the track */
.bar-fill {
  background: var(--red-bright);
  height: 100%;
  border-radius: 1px;
}

/* DO NOT do this — red as panel background is forbidden */
/* background: var(--red-bright); ← NEVER */
```

---

## Organic Parchment Border (Signature Look)

A subtle aged-paper vignette instead of a blood frame:

```css
.parchment-vignette::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at center,
    transparent 60%,
    rgba(61, 43, 26, 0.18) 85%,
    rgba(13, 10, 14, 0.35) 100%
  );
  pointer-events: none;
  border-radius: 2px;
}
```

---

## Animations — Organic & Breathing

```css
@keyframes lamb-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.03);
  }
}
@keyframes lamb-wobble {
  0%,
  100% {
    transform: rotate(0deg);
  }
  25% {
    transform: rotate(-2deg);
  }
  75% {
    transform: rotate(2deg);
  }
}
@keyframes flicker {
  0%,
  100% {
    opacity: 1;
  }
  33% {
    opacity: 0.85;
  }
  66% {
    opacity: 0.92;
  }
}
@keyframes lamb-enter {
  from {
    transform: scale(0.88);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes ink-fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

Always `ease-in-out`. Durations 150ms–2s. Never `linear` except for continuous rotations.

---

## Component Patterns

**Button:**

```css
.btn {
  font-family: "Cinzel", serif;
  font-weight: 700;
  color: var(--ink-void);
  background: var(--bg-parchment-warm);
  border: 2px solid var(--border-wood);
  border-radius: 2px;
  padding: 10px 24px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.3),
    0 3px 6px rgba(0, 0, 0, 0.3);
  transition: all 0.15s ease-in-out;
}
.btn:hover {
  background: var(--bg-parchment-deep);
  transform: translateY(-1px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 5px 10px rgba(0, 0, 0, 0.35);
}
.btn:active {
  transform: translateY(1px);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}
/* Red accent only on primary/CTA variant: */
.btn-primary {
  border-color: var(--red-blood);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 0 0 1px var(--red-bright);
}
```

**Key badge ([E] / [F]):**

```css
.key-badge {
  font-family: "Cinzel", serif;
  font-weight: 700;
  color: var(--ink-void);
  background: var(--bg-parchment-deep);
  border: 1px solid var(--border-wood);
  border-radius: 2px;
  padding: 2px 7px;
  box-shadow: 0 2px 0 var(--border-wood);
}
```

**HUD panel:**

```css
.hud-panel {
  background: var(--bg-parchment-warm);
  border: 2px solid var(--border-wood);
  border-radius: 2px;
  padding: 8px 12px;
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.1);
  position: relative;
}
```

**Stat bar (faith, health — only the fill is red):**

```css
.bar-track {
  background: var(--bg-parchment-deep);
  border: 1px solid var(--border-wood);
  border-radius: 2px;
  height: 8px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  background: var(--red-bright);
  border-radius: 1px;
  transition: width 0.4s ease-in-out;
}
```

**Section divider with rune mark:**

```css
.rune-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 1.25rem 0 0.75rem;
}
.rune-divider span {
  font-family: "Cinzel", serif;
  font-size: 0.7rem;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--red-bright);
}
.rune-divider::before,
.rune-divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border-wood);
  opacity: 0.5;
}
```

---

## Forbidden

| Never                                     | Instead                                          |
| ----------------------------------------- | ------------------------------------------------ |
| Dark backgrounds as base (`#0d0a0e` fill) | Parchment cream `--bg-parchment` as base         |
| Red as panel or card background           | Red only as line, dot, rune mark, bar fill       |
| White/bright backgrounds                  | Warm cream `--bg-parchment` – never pure white   |
| Neon or bright colors                     | Earth, ink, faded gold, blood-red accent         |
| Sans-serif or monospace fonts             | `Cinzel` or `IM Fell English` only               |
| `border-radius > 3px`                     | Max `3px` — never pill, never circle             |
| Large red fills, red panels, red headers  | Red only in small marks: corner runes, bar fills |
| Pastel gradients                          | Parchment depth gradients (cream → warm cream)   |
| Modern unstyled icon libraries            | Hand-drawn or engraved-look SVG marks            |
| Instant/jarring transitions               | Organic `ease-in-out` 150–500ms                  |
| Emojis in code or styles                  | CSS shapes, SVG paths, Unicode symbols           |
