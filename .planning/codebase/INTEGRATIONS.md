# External Integrations

**Analysis Date:** 2026-03-01

## APIs & External Services

**Not detected**

This is a client-side game with no external API integrations. All game logic, data, and state are handled locally within the browser.

## Data Storage

**Databases:**
- None - Game state is stored in Phaser Scene Registry only (in-memory, not persistent)

**File Storage:**
- Local filesystem only - Asset loading from `/public/assets/`

**Caching:**
- Browser-based only (standard HTTP caching via Vite/HTTP headers)

## State Management

**Registry (Phaser Scene Registry):**
- `playerName` - Name entered by player at start
- `currentWorld` - Currently active world (Erdwelt, Steinwelt, etc.)
- `lives` - Number of lives remaining
- `health` - Current player health value
- `score` - Cumulative score
- `attackBoost` - Attack multiplier (1 = normal, 1.25 = boosted)
- `defenseBoost` - Defense multiplier/damage reduction (1 = normal, 0.75 = boosted)

**Event-Driven Communication:**
- `playerDamaged` - Emitted when player takes damage (GameScene → UIScene)
- `playerHealed` - Emitted when player heals (GameScene → UIScene)
- `livesUpdated` - Emitted when lives change (GameScene → UIScene)
- `scoreUpdated` - Emitted when score increases (GameScene → UIScene)
- `playerAttack` - Emitted when player performs attack (Player → GameScene)
- `enemyKilled` - Emitted when enemy is defeated (GameScene → UIScene)
- `playerDied` - Emitted when player health reaches 0 (Player → GameScene)

## Authentication & Identity

**Auth Provider:**
- Not applicable - Single-player game with no user authentication

**Player Identification:**
- Local input only - Player name entered in MenuScene via HTML input

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Browser console only (no logging framework)

## CI/CD & Deployment

**Hosting:**
- Static file hosting capable (no backend required)
- Single HTML file with bundled assets (`index.html`)

**CI Pipeline:**
- Not detected - No workflow files present

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Asset Loading

**Asset Types Loaded:**
- Sprite sheets from `/public/assets/` directory
- PNG image files referenced in `PreloadScene.ts`

**Load Pattern:**
- Assets preloaded in PreloadScene before MenuScene
- Images loaded via Phaser's `load.image()` and `load.spritesheet()` APIs
- Animations created from loaded sprite sheets in PreloadScene

## Game-Specific Dependencies

**Phaser 3 Built-in Systems:**
- Animation system - Frame-based sprite animations
- Input system - Keyboard handling (no mouse/touch implemented)
- Physics system - Arcade Physics with gravity and collisions
- Timer system - Timed events (attack cooldowns, dodge cooldown, invincibility frames)
- Tween system - Smooth visual effects (flash effect on damage, fade effects)
- Event system - Publish/subscribe between scenes

---

*Integration audit: 2026-03-01*
