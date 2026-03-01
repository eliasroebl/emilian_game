# Codebase Structure

**Analysis Date:** 2026-03-01

## Directory Layout

```
/home/user/emilian_game/
├── src/                          # All game source code
│   ├── main.ts                   # Phaser GameConfig and bootstrap
│   ├── config/
│   │   └── GameConfig.ts         # Centralized constants and control bindings
│   ├── entities/
│   │   ├── Player.ts             # Player class with movement, combat, health
│   │   └── Enemy.ts              # Enemy base class, PlantEnemy, EnemyFactory
│   └── scenes/
│       ├── BootScene.ts          # Minimal init, transitions to PreloadScene
│       ├── PreloadScene.ts       # Asset loading and animation creation
│       ├── MenuScene.ts          # Title screen, player name input, game state init
│       ├── GameScene.ts          # Main gameplay, level layout, entity spawning, collisions
│       └── UIScene.ts            # HUD overlay (health, lives, score, world name)
├── public/
│   ├── assets/                   # Game sprites and backgrounds
│   │   ├── player/               # Player spritesheets (Idle, Run, Jump, Fall, etc.)
│   │   ├── enemies/              # Enemy spritesheets by type (Mushroom/, Chicken/, Plant/, Radish/, Rino/)
│   │   ├── items/                # Item spritesheets (Apple, Cherry, Kiwi, Melon, etc.)
│   │   ├── tiles/                # Terrain tileset (16x16 grid)
│   │   └── backgrounds/          # World background images (Blue, Green, Gray, etc.)
│   └── index.html                # Canvas container and game mount point
├── .planning/
│   └── codebase/                 # GSD documentation (ARCHITECTURE.md, STRUCTURE.md, etc.)
├── package.json                  # Dependencies (Phaser 3, Vite, TypeScript)
├── tsconfig.json                 # TypeScript configuration (strict mode, ES2022)
├── vite.config.ts                # Vite dev server and build config
└── CLAUDE.md                      # Project instructions and overview
```

## Directory Purposes

**src/:**
- Purpose: All TypeScript game code
- Contains: Game classes (scenes, entities), configuration, type definitions
- Key files: `main.ts` (entry point), `config/GameConfig.ts` (shared constants)

**src/config/:**
- Purpose: Centralized game tuning and constants
- Contains: Player stats, enemy stats, boss configs, item effects, control mappings, world definitions
- Key files: `GameConfig.ts` (single file holds all config)

**src/entities/:**
- Purpose: Game object classes extending Phaser sprites
- Contains: Player (movement, combat, health), Enemy base class, PlantEnemy (ranged), EnemyFactory
- Key files: `Player.ts` (main character), `Enemy.ts` (all enemy types)

**src/scenes/:**
- Purpose: Phaser Scene lifecycle managers
- Contains: Bootstrap, preload, menu, gameplay, UI
- Key files: `GameScene.ts` (largest, handles level layout and collisions), `PreloadScene.ts` (asset loading)

**public/assets/:**
- Purpose: Game media files (spritesheets and backgrounds)
- Contains: PNG spritesheets organized by entity type
- Structure: Each spritesheet is 32x32 frames except terrain (16x16) and some enemies (variable sizes)

**public/assets/player/:**
- Purpose: Player character animation spritesheets
- Contains: Idle, Run, Jump, Fall, Double Jump, Hit, Wall Jump animations (32x32 frames each)
- Convention: File names match spritesheet prefix in PreloadScene

**public/assets/enemies/:**
- Purpose: Enemy animation spritesheets organized by type
- Contains: Mushroom/, Chicken/, Plant/, Radish/, Rino/ subdirectories with Idle, Run, Hit, Attack(Plant only)
- Convention: Plant also contains Bullet.png for projectiles

**public/assets/items/:**
- Purpose: Collectible item spritesheets
- Contains: Apple (health), Cherry (attack boost), Kiwi (defense), Melon (extra life) animations (32x32 frames)
- Note: All items have 16+ frame animations; loaded but not all used in level

**public/assets/tiles/:**
- Purpose: Terrain tileset for platforms and decorations
- Contains: Single "Terrain (16x16).png" spritesheet (352x176 = 22x11 tiles)
- Usage: Frame 96 = grass top, frame 118 = dirt

**public/assets/backgrounds/:**
- Purpose: Full-screen parallax background images
- Contains: Blue, Green, Gray, Brown, Pink, Purple, Yellow (one file used per world)
- Current: "bg-green" loaded for Earth world

## Key File Locations

**Entry Points:**
- `src/main.ts`: Game bootstrap, Phaser config declaration, scene registration
- `public/index.html`: Canvas container (`id="game-container"`), script tag loads bundled game
- `src/scenes/BootScene.ts`: First scene, minimal init, transitions to PreloadScene

**Configuration:**
- `src/config/GameConfig.ts`: All tunable constants (player speed, enemy health, item effects, controls)
- `tsconfig.json`: Strict TypeScript mode, ES2022 target, path aliases not configured

**Core Logic:**
- `src/scenes/GameScene.ts`: Level design (platform positions), enemy/item spawning, collision setup, event handling
- `src/entities/Player.ts`: Player movement input, double jump, attack hitbox, dodge frames, damage/heal logic
- `src/entities/Enemy.ts`: Enemy base patrol behavior, PlantEnemy ranged attacks with cooldowns

**Asset Loading:**
- `src/scenes/PreloadScene.ts`: Load all spritesheets, textures, create all animations (lines 8-363)

**Testing:**
- No test files present in codebase

## Naming Conventions

**Files:**
- PascalCase for classes: `Player.ts`, `GameScene.ts`, `EnemyFactory.ts`
- camelCase for instances/exports: `player`, `gameScene`
- Kebab-case for asset keys/animation keys: `player-idle-anim`, `mushroom-run-anim`, `bg-green`

**Directories:**
- lowercase plural for entity collections: `src/entities/`, `src/scenes/`, `src/config/`, `public/assets/`
- lowercase plural with hyphens for asset subdirs: `public/assets/enemies/`, `public/assets/items/`, `public/assets/backgrounds/`

**Functions:**
- camelCase method names: `handleMovement()`, `performAttack()`, `setupCollisions()`
- Prefix private methods with `private`: `private handleMovement()`, `private createPlatforms()`
- Prefix boolean getters with `is`: `isEnemyDead()`, `isPlayerInvincible()`

**Variables:**
- camelCase for all variables: `cursors`, `patrolDistance`, `isDodging`
- Prefix private properties with explicit `private` keyword
- Uppercase `CONSTANTS` in GameConfig only

**Types:**
- PascalCase for interfaces: `EnemyConfig`
- No enum types currently used

## Where to Add New Code

**New Feature (World/Boss):**
- Primary code: `src/scenes/GameScene.ts` (add new spawnEnemies method or createWorld method)
- Configuration: `src/config/GameConfig.ts` (add world config, boss stats)
- Test: No test infrastructure present

**New Enemy Type:**
- Implementation: `src/entities/Enemy.ts` (add new EnemyFactory static method and EnemyConfig preset)
- Assets: `public/assets/enemies/{EnemyType}/` (subdirectory with Idle, Run, Hit spritesheets)
- Animation: `src/scenes/PreloadScene.ts` (loadEnemyAssets and createAnimations methods)
- Spawning: `src/scenes/GameScene.ts` spawnEnemies() method

**New Item Type:**
- Implementation: `src/entities/` (create Item class or use generic approach) or handle inline in `GameScene.ts`
- Assets: `public/assets/items/` (spritesheet file)
- Animation: `src/scenes/PreloadScene.ts` loadItemAssets() and createAnimations()
- Collection: `src/scenes/GameScene.ts` handleItemCollection() switch statement

**New Scene (GameOverScene, PauseScene):**
- Implementation: Create `src/scenes/{NewScene}.ts` extending Phaser.Scene
- Registration: Add to scene array in `src/main.ts` config
- Transition: Call `this.scene.launch()` or `this.scene.start()` from origin scene
- Events: Register any event listeners in create() via `this.scene.get('GameScene').events.on()`

**Utilities/Helpers:**
- Shared helpers: Create `src/utils/` directory (not yet present)
- Math helpers: Could go in `src/utils/math.ts` or inline in relevant entity/scene
- Type definitions: Add interfaces to top of relevant file or create `src/types/` directory

## Special Directories

**src/scenes/:**
- Purpose: Phaser Scene declarations and lifecycle
- Generated: No, all hand-written
- Committed: Yes

**public/assets/:**
- Purpose: Game media files
- Generated: No, external PNG files from asset packs (Pixel Adventure 2, Kings and Pigs)
- Committed: Yes

**public/index.html:**
- Purpose: DOM host for Phaser canvas
- Generated: No, hand-written
- Committed: Yes

**dist/ (if present):**
- Purpose: Vite production build output
- Generated: Yes, by `npm run build`
- Committed: No (.gitignore)

**node_modules/:**
- Purpose: NPM dependencies
- Generated: Yes, by `npm install`
- Committed: No (.gitignore)

**src/config/**
- Purpose: Single GameConfig export with all tunable constants
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-03-01*
