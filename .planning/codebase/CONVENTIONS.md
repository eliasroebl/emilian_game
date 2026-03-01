# Coding Conventions

**Analysis Date:** 2026-03-01

## Naming Patterns

**Files:**
- PascalCase for class files: `Player.ts`, `Enemy.ts`, `GameScene.ts`
- camelCase for configuration: `GameConfig.ts` (contains exported constants)
- Suffix pattern: Scene files use `Scene` suffix (`BootScene.ts`, `PreloadScene.ts`, `MenuScene.ts`, `GameScene.ts`, `UIScene.ts`)
- Suffix pattern: Entity files in `entities/` directory (`Player.ts`, `Enemy.ts`)

**Classes:**
- PascalCase: `Player`, `Enemy`, `PlantEnemy`, `EnemyFactory`, `MenuScene`, `UIScene`, `GameScene`
- Extends Phaser base classes when appropriate: `class Player extends Phaser.Physics.Arcade.Sprite`
- Interfaces for configuration: `EnemyConfig` defines enemy statistics

**Functions:**
- camelCase for methods: `handleMovement()`, `setupInput()`, `createPlatforms()`, `spawnEnemies()`
- Private methods prefixed with `private`: `private handleJump()`, `private performAttack()`
- Public accessor methods: `getHealth()`, `getMaxHealth()`, `getDamage()`, `isPlayerInvincible()`
- Compound verb pattern: `handle*` for event handlers, `setup*` for initialization, `create*` for object creation, `spawn*` for entity spawning, `update*` for UI updates

**Variables:**
- camelCase for regular variables: `playerName`, `attackBoost`, `defenseBoost`, `dodgeDirection`
- boolean flags prefixed with `is`, `can`, or `has`: `isAttacking`, `canAttack`, `canDoubleJump`, `hasDoubleJumped`, `isInvincible`, `isDodging`, `canDodge`, `isDead`, `isHurt`
- UPPER_SNAKE_CASE for exported constants: `GAME_CONFIG`, `CONTROLS` in `GameConfig.ts`
- Private fields marked with `private`: `private health: number`, `private maxHealth: number`

**Types:**
- PascalCase for interfaces: `EnemyConfig`, extends from Phaser types when used
- Type annotations on all class fields: `private cursors!: Phaser.Types.Input.Keyboard.CursorKeys`
- Non-null assertion operator `!` used when fields are initialized in constructor or setup methods

**Animation Keys:**
- Kebab-case with suffix: `player-idle-anim`, `player-run-anim`, `mushroom-attack-anim`, `plant-idle-anim`
- Pattern: `{spriteType}-{state}-anim`

**Sprite/Texture Keys:**
- Kebab-case: `player-idle`, `mushroom-run`, `terrain`, `plant-bullet`, `bg-green`

**Event Names:**
- camelCase: `playerAttack`, `playerDamaged`, `playerHealed`, `livesUpdated`, `scoreUpdated`, `enemyKilled`, `playerDied`
- Emitted via scene events: `this.scene.events.emit('playerAttack', ...)`

## Code Style

**Formatting:**
- No dedicated formatter configured (no `.prettierrc`, Prettier config, or biome.json found)
- Consistent 2-space indentation observed throughout codebase
- Line lengths generally kept under 100 characters
- Imports at top of file before class definitions

**Linting:**
- TypeScript strict mode enabled in `tsconfig.json`
- Compiler options enforced:
  - `strict: true` - Full type checking
  - `noUnusedLocals: true` - All variables must be used
  - `noUnusedParameters: true` - Function parameters must be used
  - `noFallthroughCasesInSwitch: true` - Switch cases require breaks or returns
  - `noUncheckedSideEffectImports: true` - Imports must be type or value
- No ESLint configuration found; TypeScript compiler provides linting via `tsc`

**Build Check:**
- TypeScript compilation required before Vite bundling: `npm run build` runs `tsc && vite build`

## Import Organization

**Order:**
1. Framework imports from `phaser` (always first)
2. Local imports from relative paths (`..`, `.`)

**Pattern:**
```typescript
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { Player } from '../entities/Player';
import { GAME_CONFIG } from '../config/GameConfig';
```

**Path Aliases:**
- No path aliases configured (no `paths` or `baseUrl` in `tsconfig.json`)
- Relative paths used throughout: `../config/GameConfig`, `../entities/Player`, `./scenes/GameScene`

**Exports:**
- Default exports not used; all exports are named exports
- Pattern: `export class ClassName { ... }`, `export interface InterfaceName { ... }`, `export const CONSTANT_NAME = {...}`

## Error Handling

**Null/Undefined Checks:**
- Non-null assertion `!` on Phaser properties initialized in constructor: `const body = this.body as Phaser.Physics.Arcade.Body;`
- Optional chaining rarely used; instead defensive checks with `if` statements
- Example: `if (!this.scene.input.keyboard) return;` in `Player.setupInput()`

**Defensive Programming:**
- Guard clauses for state checks: `if (this.isDead || this.isHurt) return;` in `Enemy.update()`
- Guard clauses for invincibility: `if (this.isInvincible) return;` before damage application
- Guard clauses for dead enemies: `if (!e.isEnemyDead())` before applying damage
- Null checks on optional DOM elements: `if (this.nameInput) { ... }`

**State Validation:**
- Early returns prevent invalid operations: `if (this.isDead) return;` prevents further updates
- Invincibility window prevents cascading damage: checked before `takeDamage()` is processed
- Dead state prevents animations and attacks after death

**No Try/Catch Blocks:**
- No error handling via try/catch observed
- Phaser scene lifecycle methods (`create`, `update`, `preload`) assumed to work
- TypeScript strict mode catches most errors at compile time

## Logging

**Framework:** `console` methods used (no dedicated logger)

**Patterns:**
```typescript
// Single console.log for player welcome:
console.log(`Willkommen, ${playerName}!`);
```

**When to Log:**
- Minimal logging in codebase; only player entry message logged
- No error logging observed; assume Phaser console reports errors
- No debug output in game; development relies on TypeScript strict mode

## Comments

**When to Comment:**
- Comments used sparingly
- Section comments for level design: `// === SECTION 1: Tutorial (easy platforms, mushrooms) ===`
- Comments for non-obvious game mechanics: `// Pop up effect` on knockback velocity
- Comments for future features: `// We don't have an attack animation in the current assets`

**JSDoc/TSDoc:**
- No JSDoc comments observed in codebase
- Type annotations on parameters and returns preferred over comments
- Constructor parameters documented by type: `constructor(scene: Phaser.Scene, x: number, y: number)`

**Code Comments:**
- Inline comments explain "why" not "what": `// Dodge in facing direction` before `this.dodgeDirection = this.facingRight ? 1 : -1;`
- Comments on complex calculations: `// Calculate direction to player` before angle calculation
- Comments mark debug features: `debug: false // Set to true for development` in Phaser config

## Function Design

**Size:**
- Average method size: 10-40 lines
- Largest methods: `GameScene.create()` (43 lines), `Player.update()` (18 lines)
- Helper methods break concerns: `handleMovement()`, `handleJump()`, `handleAttack()`, `handleDodge()`, `updateAnimations()` called from `Player.update()`

**Parameters:**
- Constructor: entity position and scene reference typical: `constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig)`
- Callback handlers use Phaser event signatures: `handlePlayerEnemyCollision(playerObj: Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Tilemaps.Tile, enemyObj: ...)`
- Factory methods use scene and position: `static createMushroom(scene: Phaser.Scene, x: number, y: number): Enemy`
- Optional parameters with defaults in configs: `scale?: number` in `EnemyConfig`, defaults to 2

**Return Values:**
- void for update/lifecycle methods: `update(): void`, `create(): void`
- Specific return types for accessors: `getHealth(): number`, `isPlayerInvincible(): boolean`
- Factory methods return typed instances: `static createMushroom(...): Enemy`
- No implicit any returns; all methods explicitly typed

## Module Design

**Exports:**
- Each entity class exported from its file: `export class Player { ... }` from `Player.ts`
- Factory pattern exported alongside main class: `export class EnemyFactory` in `Enemy.ts`
- Configuration exported as single constant: `export const GAME_CONFIG`, `export const CONTROLS`

**Barrel Files:**
- No barrel files (index.ts) used; direct imports from specific files required

**File Organization:**
- One class per file (except `Enemy.ts` which contains `Enemy`, `EnemyFactory`, and `PlantEnemy` due to tight coupling)
- Configuration centralized in `GameConfig.ts`
- Scenes grouped in `scenes/` directory
- Entities grouped in `entities/` directory

**Inheritance vs Composition:**
- Inheritance from Phaser base classes: `Player extends Phaser.Physics.Arcade.Sprite`
- Composition with scene references: entities take scene as constructor param
- Configuration objects passed to constructors: `EnemyFactory.createMushroom(scene, x, y)` returns configured Enemy
- Event-driven communication between scenes via Phaser's event emitter

## Class Field Initialization

**Pattern:**
- Fields declared at class level with type and initial value: `private canDoubleJump: boolean = false;`
- Non-null assertion `!` for fields set in setup methods: `private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;`
- Registry-based state for cross-scene data: `this.scene.registry.get('health')`, `this.scene.registry.set('health', value)`

---

*Convention analysis: 2026-03-01*
