# Technology Stack

**Analysis Date:** 2026-03-01

## Languages

**Primary:**
- TypeScript 5.9.3 - All source code (strict mode, ES2022 target)

## Runtime

**Environment:**
- Node.js 18+ (enforced by esbuild)

**Package Manager:**
- npm
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- Phaser 3.90.0 - 2D game engine with Arcade Physics

**Build/Dev:**
- Vite 7.2.4 - Fast bundler and dev server
- TypeScript 5.9.3 - Type checking and compilation

## Key Dependencies

**Critical:**
- Phaser 3.90.0 - Game engine that provides:
  - Scene management (BootScene, PreloadScene, MenuScene, GameScene, UIScene)
  - Arcade Physics (gravity, collisions, sprite bodies)
  - Animation system (sprite sheets, frame-based animations)
  - Input handling (keyboard, touch)
  - Timer system (delayedCall, events)
  - Tweens system (animation effects)
  - Game object hierarchy (Sprites, Graphics, Text)

## Configuration

**Environment:**
- No environment variables required for development or production
- Configuration is code-based via `src/config/GameConfig.ts`

**Build:**
- `tsconfig.json` - TypeScript compilation settings:
  - Target: ES2022
  - Module: ESNext
  - Strict mode enabled
  - `noUnusedLocals`, `noUnusedParameters` enforced
  - Module resolution: bundler
  - No emit (type checking only, Vite handles bundling)

**Game Configuration:**
- `src/config/GameConfig.ts` - Contains all tunable constants:
  - Player stats (speed, jump velocity, health, attack damage, dodge cooldown)
  - World definitions (Erdwelt, Steinwelt, Wasserwelt, Wolkenwelt)
  - Enemy stats (health, damage, speed, points)
  - Boss settings (Earth Snake with 2-phase design)
  - Item effects (attack boost, defense boost, extra life, health potion)
  - Physics constants (tile size, gravity)
  - Control mappings (keyboard keys for movement, jump, attack, dodge, pause)

## Platform Requirements

**Development:**
- Node.js 18+
- npm or compatible package manager
- Terminal/shell for running build commands

**Production:**
- Modern web browser with HTML5 Canvas support
- Resolution: 800×600 (pixel art mode, auto-scaled to fit window)
- No special server or backend required (static client-side game)

## Game Technical Details

**Resolution:**
- 800×600 px (fixed aspect ratio)
- Pixel art rendering enabled
- Auto-centered and fitted to window

**Physics Engine:**
- Phaser Arcade Physics
- Gravity: 800 px/s²
- Collision-based gameplay (world bounds, platform collisions, enemy hits)

**Rendering:**
- HTML5 Canvas (Phaser.AUTO selects best available)
- Sprite-based rendering with 2× scale
- Auto-positioning within `<div id="game-container">`

---

*Stack analysis: 2026-03-01*
