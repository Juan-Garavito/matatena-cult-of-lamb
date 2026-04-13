---
name: styles-retro
description: A strict visual design system for a retro video game style project.
---
# 🕹️ Retro Video Game Visual Style — Project Instructions

This file defines the mandatory visual design system for this project.
**Apply these rules to every UI component, screen, page, menu, form, button, or any visual element you create or modify.**
Never deviate from this style without explicit approval.

---

## 🎨 Color Palette

Always use these CSS variables. Never use colors outside this palette.

```css
:root {
  /* Backgrounds */
  --color-bg:          #0d0d1a;
  --color-bg-alt:      #1a1a2e;
  --color-bg-panel:    #16213e;

  /* Brand */
  --color-primary:     #00ff88;  /* Neon green — CTAs, active states */
  --color-secondary:   #ff00ff;  /* Magenta — accents, highlights */
  --color-accent:      #00ffff;  /* Cyan — links, active icons */
  --color-warning:     #ffff00;  /* Yellow — alerts */
  --color-danger:      #ff0044;  /* Red — errors */

  /* Text */
  --color-text:        #e8e8e8;
  --color-text-dim:    #888899;
  --color-text-bright: #ffffff;
}
```

---

## 🔤 Typography

Only these fonts are allowed — import them in the project entry point.

```html
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">
```

| Use case | Font |
|---|---|
| Titles, buttons, labels, scores | `'Press Start 2P', monospace` |
| Body text, dialogs, descriptions | `'VT323', monospace` — min size 1.2rem |

**Never use** modern fonts (Inter, Roboto, system-ui, sans-serif).

---

## 📐 Borders & Shapes

- **`border-radius` must always be `0`** — no rounded corners, ever.
- Use offset `box-shadow` to simulate pixel-art depth.

```css
/* Standard panel border */
border: 2px solid var(--color-primary);
box-shadow: 4px 4px 0 var(--color-primary);

/* Neon glow — for active/focused elements */
box-shadow:
  0 0 8px var(--color-primary),
  0 0 20px var(--color-primary),
  inset 0 0 8px rgba(0, 255, 136, 0.1);
```

---

## ✨ Animations

Use these keyframes — prefer `linear` or `steps(n)` timing, never `ease` or `ease-in-out`.

```css
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

@keyframes glitch {
  0%   { text-shadow: 2px 0 #ff00ff, -2px 0 #00ffff; }
  25%  { text-shadow: -2px 0 #ff00ff, 2px 0 #00ffff; }
  50%  { text-shadow: 2px 2px #ff00ff, -2px -2px #00ffff; }
  100% { text-shadow: 2px 0 #ff00ff, -2px 0 #00ffff; }
}

@keyframes typewriter {
  from { width: 0; }
  to   { width: 100%; }
}
```

**Scanlines overlay** — add to the main wrapper:

```css
.scanlines::after {
  content: '';
  position: fixed;
  inset: 0;
  background: repeating-linear-gradient(
    0deg,
    transparent 0px,
    transparent 2px,
    rgba(0,0,0,0.15) 2px,
    rgba(0,0,0,0.15) 4px
  );
  pointer-events: none;
  z-index: 9999;
}
```

---

## 🎮 Component Patterns

### Button
```css
.btn {
  font-family: 'Press Start 2P', monospace;
  font-size: 0.75rem;
  background: transparent;
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  border-radius: 0;
  padding: 12px 24px;
  text-transform: uppercase;
  letter-spacing: 2px;
  box-shadow: 4px 4px 0 var(--color-primary);
  cursor: pointer;
  transition: all 0.1s linear;
}
.btn:hover {
  background: var(--color-primary);
  color: var(--color-bg);
  box-shadow: 0 0 20px var(--color-primary);
}
.btn:active {
  transform: translate(4px, 4px);
  box-shadow: none;
}
```

### Input / Form field
```css
input, textarea, select {
  background: var(--color-bg-alt);
  border: 2px solid var(--color-accent);
  border-radius: 0;
  color: var(--color-text);
  font-family: 'VT323', monospace;
  font-size: 1.2rem;
  padding: 8px 12px;
  outline: none;
}
input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 10px var(--color-primary);
}
```

### Card / Panel
```css
.card {
  background: var(--color-bg-panel);
  border: 2px solid var(--color-secondary);
  border-radius: 0;
  box-shadow: 4px 4px 0 var(--color-secondary);
  padding: 1.5rem;
}
```

### Progress / Health bar
```css
.bar-bg   { background: var(--color-bg-alt); border: 2px solid var(--color-text-dim); height: 20px; }
.bar-fill { background: var(--color-primary); box-shadow: 0 0 10px var(--color-primary);
            transition: width 0.3s steps(10); }
```

### Navigation menus
- Use `▶` as the active item indicator (ASCII, not an icon library)
- Use `─────────────────` for dividers
- Active item: `color: var(--color-primary)` + optional blink animation

### Loading states
- Text: `LOADING...` or `CARGANDO...` with blinking `█` cursor
- ASCII spinner: cycle through `|` `/` `–` `\`

---

## 🚫 Never Do This

| ❌ Forbidden | ✅ Instead |
|---|---|
| `border-radius > 0` | Always `border-radius: 0` |
| Smooth gradients | Use flat colors or scanline patterns |
| `ease`, `ease-in-out` on animations | Use `linear` or `steps(n)` |
| Light/white backgrounds | Always dark (`#0d0d1a` or similar) |
| Modern sans-serif fonts | Only Press Start 2P or VT323 |
| Soft drop shadows in gray/black | Only colored neon glows |
| Modern icon libraries unstyled | Pixelate or use ASCII/emoji |

---

## ✅ Checklist Before Submitting Any Visual Component

- [ ] Uses only palette colors above
- [ ] Uses Press Start 2P or VT323
- [ ] `border-radius: 0` everywhere
- [ ] Offset box-shadow for pixel-art depth
- [ ] Hover/active feedback is immediate (no smooth transitions)
- [ ] Dark background
- [ ] Sufficient contrast on all text
