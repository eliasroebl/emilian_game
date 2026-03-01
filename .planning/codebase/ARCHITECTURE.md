# Architecture

**Analysis Date:** 2026-03-01

## Pattern Overview

**Overall:** Scene-based game state machine with event-driven inter-scene communication, layered entity model (Player, Enemy variants), and centralized game state via Phaser Registry.

**Key Characteristics:**
- Phaser 3 Scene pattern for game lifecycle management (BootScene → PreloadScene → MenuScene → GameScene + UIScene)
- Registry-based shared state across all scenes
- Event-driven communication between GameScene and UIScene
- Entity encapsulation: Player and Enemy classes extend Phaser.Physics.Arcade.Sprite
- Factory pattern for enemy creation (EnemyFactory) with special handling for ranged enemies
- Static platform-based level layout (procedural, no tilemap editor)

## Layers

**Bootstrap Layer:**
- Purpose: Initialize game instance and bootstrap scene sequence
- Location: `src/main.ts`
- Contains: Phaser GameConfig with physics setup, scene declarations, canvas mounting
- Depends on: All scene classes
- Used by: HTML container with `id="game-container"`

**Preload Layer:**
- Purpose: Load all assets (sprites, spritesheets, animations) and create animation definitions
- Location: `src/scenes/PreloadScene.ts`
- Contains: Asset loading (players, enemies, terrain, items, backgrounds), animation factory
- Depends on: Public assets directory
- Used by: MenuScene (via scene transition)

**Menu/Input Layer:**
- Purpose: Capture player name input, initialize game state, transition to gameplay
- Location: `src/scenes/MenuScene.ts`
- Contains: HTML input element for player name, game state initialization via Registry
- Depends on: PreloadScene (for assets)
- Used by: GameScene launch

**Configuration Layer:**
- Purpose: Centralized tunable constants for all game mechanics
- Location: `src/config/GameConfig.ts`
- Contains: Player stats (speed, jump, health, cooldowns), enemy stats, item effects, control bindings, world definitions
- Depends on: None (pure configuration)
- Used by: Player, Enemy, GameScene, UIScene

**Game Logic Layer:**
- Purpose: Handle game state, entity updates, collisions, level layout, event dispatching
- Location: `src/scenes/GameScene.ts`
- Contains: Player instantiation, platform/enemy/item spawning, physics collisions, event listeners for attacks/death/items, level design
- Depends on: Player, Enemy, EnemyFactory, GAME_CONFIG
- Used by: Phaser game loop

**Entity Layer:**
- Purpose: Encapsulate character behavior (movement, combat, state)
- Location: `src/entities/Player.ts`, `src/entities/Enemy.ts`
- Contains: Input handling, animation state, health/cooldowns, collision callbacks
- Depends on: GAME_CONFIG, Phaser physics/sprites
- Used by: GameScene (instantiation and updates)

**UI Overlay Layer:**
- Purpose: Render HUD and respond to game events
- Location: `src/scenes/UIScene.ts`
- Contains: Health bar, lives display, score, world name, controls hint
- Depends on: GameScene event emissions
- Used by: Phaser game loop (parallel to GameScene)

## Data Flow

**Scene Initialization:**

1. BootScene launches → PreloadScene
2. PreloadScene loads assets, creates animations → MenuScene
3. MenuScene captures name, initializes Registry values → GameScene (start) + UIScene (launch in parallel)
4. GameScene create() → GameOverScene (on player death)

**Gameplay Loop:**

1. Input (Player handles keyboard)
2. Physics updates (Phaser Arcade)
3. Update cycle: GameScene.update() calls Player.update() and enemy updates
4. Collisions detected by Phaser physics engine
5. Events emitted (playerAttack, playerDamaged, enemyKilled, etc.)
6. UIScene listens and updates HUD

**Item Collection:**

1. Player overlaps item
2. GameScene.handleItemCollection() identifies type via item.getData('type')
3. Registry updated (attackBoost, defenseBoost, lives, health)
4. UIScene event listeners reflect changes
5. Temporary boosts have auto-expire timers via time.delayedCall()

**State Management:**

- **Registry keys:** playerName, currentWorld, lives, health, score, attackBoost, defenseBoost
- **Player internal state:** health, canJump, isDodging, isAttacking, isInvincible, facingRight
- **Enemy internal state:** isDead, isHurt, direction, patrolDistance
- **PlantEnemy additional state:** shootCooldown, detectionRange, bullets group

## Key Abstractions

**Player:**
- Purpose: Represents playable character with movement, attacks, dodging, health
- Examples: `src/entities/Player.ts`
- Pattern: Extends Phaser.Physics.Arcade.Sprite, handles input internally, emits events on damage/heal/death

**Enemy:**
- Purpose: Base patrol enemy with melee attack capability
- Examples: `src/entities/Enemy.ts` (Mushroom, Chicken, Rino, Radish created via factory)
- Pattern: Extends Phaser.Physics.Arcade.Sprite, patrol logic with distance tracking, knockback on hit

**PlantEnemy:**
- Purpose: Stationary ranged enemy that shoots projectiles
- Examples: `src/entities/Enemy.ts` (separate class, not extending Enemy)
- Pattern: Extends Phaser.Physics.Arcade.Sprite, maintains separate bullets group, calculates angle to player, 2-second cooldown

**EnemyFactory:**
- Purpose: Create enemy instances with preconfigured stats
- Examples: `src/entities/Enemy.ts` (static factory methods)
- Pattern: Static class, each method returns Enemy or PlantEnemy with preset EnemyConfig values

**EnemyConfig:**
- Purpose: Define enemy characteristics (health, damage, speed, animation keys)
- Examples: Interface in `src/entities/Enemy.ts`
- Pattern: Passed to Enemy constructor, provides spray-painted stats per enemy type

## Entry Points

**Game Bootstrap:**
- Location: `src/main.ts`
- Triggers: Page load
- Responsibilities: Create Phaser.Game instance with config, mount to DOM, start BootScene

**Scene Transitions:**
- Location: `src/scenes/BootScene.ts` → PreloadScene
- Location: `src/scenes/PreloadScene.ts` → MenuScene
- Location: `src/scenes/MenuScene.ts` → GameScene + UIScene
- Responsibilities: Asset loading, animation creation, game state initialization

**Game Loop Update:**
- Location: `src/scenes/GameScene.ts` update()
- Triggers: Every frame (60 FPS)
- Responsibilities: Update player, update enemies, parallax background, apply physics

**Collision Handlers:**
- Location: `src/scenes/GameScene.ts` (setupCollisions, setupEvents)
- Triggers: Phaser overlap/collide events
- Responsibilities: Player-enemy damage, item collection, bullet hits, attack hitbox validation

## Error Handling

**Strategy:** Defensive checks on state before operations; no explicit error boundaries (Phaser handles physics exceptions).

**Patterns:**
- Check `isDead` before allowing enemy damage/actions
- Check `isInvincible` before applying player damage
- Null-check attackHitbox after destruction
- Validate enemy type cast before calling methods
- Guard against missing animations with `anims.exists()`

## Cross-Cutting Concerns

**Logging:** Console.log for player welcome message in GameScene; no structured logging framework.

**Validation:** Input validation on player name (20 char max), no runtime type checking beyond TypeScript strict mode.

**Animation:** PreloadScene creates all animations, entities call play() with animation keys. Animation keys follow pattern: `{prefix}-{state}-anim` (e.g., "mushroom-idle-anim").

**Physics:** Arcade Physics singleton; gravity 800 px/s², all moving entities use Arcade bodies, collide/overlap handlers reference scene physics.

---

*Architecture analysis: 2026-03-01*
