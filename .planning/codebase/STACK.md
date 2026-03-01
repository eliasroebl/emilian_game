# STACK.md — Technology Stack

## Overview

"Krone des Gingers" is a browser-based 2D game built with TypeScript and the Phaser 3 game framework, bundled by Vite and deployed as a static site to GitHub Pages.

---

## Language

- **TypeScript ~5.9.3** — strict mode, no emit (bundler handles output)
- Target: `ES2022`
- Module system: `ESNext` with bundler resolution (`moduleResolution: "bundler"`)

### `tsconfig.json` highlights

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

Notable flags:
- `verbatimModuleSyntax` — enforces `import type` for type-only imports
- `erasableSyntaxOnly` — disallows TS-only syntax that can't be erased cleanly
- `noUncheckedSideEffectImports` — blocks bare side-effect imports without explicit intent

---

## Runtime

- **Browser** — no server-side runtime; purely client-side
- HTML entry: `index.html`
- JS entry: `src/main.ts`
- Output: static files in `dist/` served under `/emilian_game/` base path

---

## Game Framework

- **Phaser 3** (`^3.90.0`) — the only runtime dependency
- Renderer: `Phaser.AUTO` (WebGL with Canvas fallback)
- Physics: Arcade Physics, gravity `{ x: 0, y: 650 }`
- Input: multi-touch enabled (`activePointers: 4`)
- Scale: `FIT` + `CENTER_BOTH` for responsive layout

### Game configuration (`src/main.ts`)

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  pixelArt: true,
  input: { activePointers: 4 },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 650 }, debug: false }
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, VirtualControlsScene, TestScene],
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
};
```

### Scene pipeline

| Scene | Role |
|---|---|
| `BootScene` | Initial setup / asset config |
| `PreloadScene` | Asset loading / progress |
| `MenuScene` | Main menu |
| `GameScene` | Core gameplay |
| `UIScene` | HUD overlay |
| `VirtualControlsScene` | Mobile touch controls |
| `TestScene` | Dev/QA testing scene |

---

## Build Tool

- **Vite ^7.2.4** — dev server and production bundler
- Config file: `vite.config.ts`

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/emilian_game/',
});
```

- `base: '/emilian_game/'` — matches the GitHub Pages subdirectory path
- ESM-native (`"type": "module"` in `package.json`)

### npm scripts (`package.json`)

```json
{
  "scripts": {
    "dev":     "vite",
    "build":   "tsc && vite build",
    "preview": "vite preview"
  }
}
```

- `dev` — hot-reload dev server
- `build` — TypeScript type-check first, then Vite bundle to `dist/`
- `preview` — serve the built `dist/` locally

---

## Testing

- **Playwright `^1.58.2`** — end-to-end browser tests
- Browser: Firefox only (installed via `--with-deps` in CI)
- Tests run against the built game served on port 5173

---

## Dependencies Summary

| Package | Type | Version | Purpose |
|---|---|---|---|
| `phaser` | runtime | `^3.90.0` | Game engine |
| `vite` | dev | `^7.2.4` | Build tool / dev server |
| `typescript` | dev | `~5.9.3` | Type checking |
| `@playwright/test` | dev | `^1.58.2` | E2E testing |

---

## Mobile / PWA Support

`index.html` includes:
- Web App Manifest: `/emilian_game/manifest.json`
- iOS fullscreen meta tags (`apple-mobile-web-app-capable`, etc.)
- Viewport locked to prevent zoom (`maximum-scale=1.0, user-scalable=no`)
- Safe-area inset padding for notch/home-indicator devices
- Portrait rotation overlay (CSS media query) — prompts landscape on mobile
- `touch-action: none` on canvas, `pan-x pan-y` on body (preserves Phaser touch events)

---

## Configuration Files

| File | Purpose |
|---|---|
| `package.json` | Dependencies, scripts, module type |
| `tsconfig.json` | TypeScript compiler options |
| `vite.config.ts` | Vite bundler config (base path) |
| `index.html` | HTML shell, PWA meta, CSS resets |
| `src/main.ts` | Phaser game bootstrap |
