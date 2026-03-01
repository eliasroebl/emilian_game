# Testing Patterns

**Analysis Date:** 2026-03-01

## Test Framework

**Status:** Not implemented

**Runner:**
- No test framework configured (Jest, Vitest, Mocha, etc. not found)
- No test files present in codebase
- No `jest.config.js`, `vitest.config.js`, or similar configuration files

**Available Tools:**
- TypeScript compiler (`tsc`) provides type checking as pre-compile validation
- Run via: `npm run build` which runs `tsc && vite build`

**Build Validation:**
```bash
npm run build              # Runs TypeScript check + Vite build
```

## Test File Organization

**Status:** No test files present

**Current Structure:**
```
src/
├── config/
│   └── GameConfig.ts
├── entities/
│   ├── Player.ts
│   └── Enemy.ts
├── scenes/
│   ├── BootScene.ts
│   ├── PreloadScene.ts
│   ├── MenuScene.ts
│   ├── GameScene.ts
│   └── UIScene.ts
└── main.ts
```

**Recommended Pattern (if tests added):**
```
src/
├── config/
│   ├── GameConfig.ts
│   └── GameConfig.test.ts
├── entities/
│   ├── Player.ts
│   ├── Player.test.ts
│   ├── Enemy.ts
│   └── Enemy.test.ts
├── scenes/
│   └── GameScene.ts
└── main.ts
```

## Type Safety As Pre-Build Check

**TypeScript Strict Mode:**
- All modules must compile without errors before bundling
- Compiler enforced validations:
  - All variables used (no unused locals)
  - All parameters used (no unused parameters)
  - All switch cases handled or explicitly broken
  - No unchecked side effects from imports

**Example - GameConfig validation:**
```typescript
// src/config/GameConfig.ts - All constants must be properly typed
export const GAME_CONFIG = {
  PLAYER: {
    SPEED: 200,                    // number verified
    MAX_HEALTH: 100,
    ATTACK_RANGE: 40,
    // Any missing property in PLAYER usage detected at compile time
  },
  WORLDS: {
    EARTH: {
      name: 'Erdwelt',             // string verified
      lives: 3,                    // number verified
      backgroundColor: 0x87CEEB,
    },
  },
};
```

**Example - Type checking on class fields:**
```typescript
// src/entities/Player.ts - Private field types enforced
private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
private canDoubleJump: boolean = false;
private health: number;

// Compiler ensures:
// 1. All fields are initialized or have non-null assertion
// 2. All access to fields matches declared type
// 3. Private fields not accessed from outside class
```

## Manual Testing Approach

**Current Testing Method:** Manual playthrough via development server

**Development Workflow:**
```bash
npm run dev        # Start Vite dev server with hot reload
# Then manually test:
# 1. Player movement - Arrow keys / WASD move left/right
# 2. Jumping - Space/Up/W triggers jump
# 3. Double jump - Space in air triggers second jump
# 4. Attack - X creates melee hitbox
# 5. Dodge - C triggers invincibility dash
# 6. Enemy patrol - Enemies move in patrol pattern
# 7. Collision - Player takes damage from enemy contact
# 8. Item pickup - Items grant health/attack/defense/life
# 9. Plant shooting - Plant enemy shoots bullets at player
# 10. UI updates - Health bar, lives, score update correctly
```

## State Machine Verification

**Player State Tracking (implicit testing via conditionals):**
```typescript
// src/entities/Player.ts - State checked via conditionals
if (this.isDodging) {
  // Continue dodge movement, return early
  // Tests: dodge state prevents normal movement
}

if (this.isAttacking) {
  // Slow down during attack
  // Tests: attack state overrides normal movement
}

if (this.isInvincible) {
  // takeDamage() returns early
  // Tests: invincibility prevents damage
}

if (this.canDoubleJump && !this.hasDoubleJumped) {
  // Only allow double jump once per air time
  // Tests: double jump limited to one per airtime
}
```

**Enemy State Tracking:**
```typescript
// src/entities/Enemy.ts - State guards
if (this.isDead || this.isHurt) return;  // Skip patrol when dead/hurt

if (this.isDead) return;  // takeDamage() exits early if dead
```

**Collision Callback Validation:**
```typescript
// src/scenes/GameScene.ts
if (!enemy.isEnemyDead() && !player.isPlayerInvincible()) {
  player.takeDamage(enemy.getDamage());
  // Tests: damage not applied if either state wrong
}
```

## Event-Driven Testing Points

**Player Attack Validation:**
```typescript
// Player emits event when attacking
this.scene.events.emit('playerAttack', this.attackHitbox, this.getAttackDamage());

// GameScene checks for overlaps with emitted hitbox
this.events.on('playerAttack', (hitbox: Phaser.GameObjects.Rectangle, damage: number) => {
  this.enemies.getChildren().forEach((enemy) => {
    const bounds = hitbox.getBounds();
    const enemyBounds = e.getBounds();
    if (Phaser.Geom.Rectangle.Overlaps(bounds, enemyBounds)) {
      e.takeDamage(damage);
    }
  });
});
```

**Health System Validation:**
```typescript
// Player health reduced on damage
this.health -= actualDamage;

// Health persisted to registry
this.scene.registry.set('health', this.health);

// Event emitted for UI update
this.scene.events.emit('playerDamaged', this.health, this.maxHealth);

// UIScene listens and updates display
gameScene.events.on('playerDamaged', (health: number, maxHealth: number) => {
  this.updateHealthBar(health, maxHealth);
});
```

**Item Collection Validation:**
```typescript
// Switch statement on item type
switch (type) {
  case 'health':
    player.heal(GAME_CONFIG.ITEMS.HEALTH_POTION.healAmount);  // Tests: heal amount correct
    break;
  case 'attack':
    this.registry.set('attackBoost', currentAttack * GAME_CONFIG.ITEMS.ATTACK_BOOST.multiplier);
    // Tests: attack boost applied, timed correctly
    break;
  case 'defense':
    this.registry.set('defenseBoost', currentDefense * GAME_CONFIG.ITEMS.DEFENSE_BOOST.multiplier);
    // Tests: defense reduces damage via takeDamage()
    break;
  case 'life':
    this.registry.set('lives', currentLives + 1);
    // Tests: extra life added, persisted to registry
    break;
}
```

## Physics Validation

**Collision Detection:**
```typescript
// src/scenes/GameScene.ts - Collisions set up once in create()
this.physics.add.collider(this.player, this.platforms);
this.physics.add.collider(this.enemies, this.platforms);
this.physics.add.overlap(this.player, this.enemies, this.handlePlayerEnemyCollision, ...);
this.physics.add.overlap(this.player, this.items, this.handleItemCollection, ...);
this.physics.add.overlap(this.player, plant.getBullets(), this.handleBulletHit, ...);

// Tests (manual verification):
// - Player can't fall through platforms
// - Enemies don't fall through platforms
// - Player takes damage from enemy contact
// - Items are collected on overlap
// - Plant bullets deal damage on overlap
```

**Gravity and Jump Mechanics:**
```typescript
// src/main.ts - Gravity configured
physics: {
  default: 'arcade',
  arcade: {
    gravity: { x: 0, y: 800 },    // Applies downward force
  }
}

// Tests (manual):
// - Player falls when not jumping (gravity: 800)
// - Jump velocity counteracts gravity (JUMP_VELOCITY: -400)
// - Double jump at lower velocity (DOUBLE_JUMP_VELOCITY: -350)
// - Enemies don't use gravity (setAllowGravity(false) on some)
```

## Animation Testing

**Animation Existence Checks:**
```typescript
// src/scenes/GameScene.ts - Defensive check
const animKey = `${sprite}-anim`;
if (this.anims.exists(animKey)) {
  item.play(animKey);
}

// Tests: Only plays animation if it exists (prevents errors for missing animations)
```

**Animation Creation Validation:**
```typescript
// src/scenes/PreloadScene.ts - All animations created during load
// Example pattern for all 30+ animations:
this.anims.create({
  key: 'player-idle-anim',
  frames: this.anims.generateFrameNumbers('player-idle', { start: 0, end: 10 }),
  frameRate: 10,
  repeat: -1,  // Loops
});

// Tests (implicit):
// - Frame ranges match spritesheet dimensions
// - All animations can be played without error
// - Animations loop correctly (repeat: -1)
// - One-shot animations complete (repeat: 0)
```

## Registry (Shared State) Testing

**Initial State Setup:**
```typescript
// src/scenes/MenuScene.ts - All shared state initialized
this.registry.set('playerName', this.playerName);
this.registry.set('currentWorld', 'EARTH');
this.registry.set('lives', 3);
this.registry.set('health', 100);
this.registry.set('score', 0);
this.registry.set('attackBoost', 1);
this.registry.set('defenseBoost', 1);

// Tests (manual):
// - All values persist across scenes
// - Health returned from registry in Player: this.health = this.scene.registry.get('health') || this.maxHealth;
// - Score accumulated: currentScore + points
// - Boosts applied to damage/health calculations
```

## What Is Not Tested

**Untested Areas:**
- GameOverScene (referenced but not created)
- Pause system (ESC key configured but no pause logic implemented)
- Multiple worlds (Stone, Water, Cloud worlds defined in config but only Earth playable)
- Boss fights (Earth Snake configured with 2-phase design but not spawned)
- Chicken and Rino enemies (loaded but not placed in active level)
- Melee attack damage calculation with boost applied (no unit test)
- Defense boost reduction calculation (no unit test)
- Death and respawn edge cases (respawn logic exists but untested for edge cases)
- Bullet collisions with terrain (bullets have world bounds check but no collision callbacks)
- Plant enemy detection range edge cases

## Coverage Gaps

**Critical Gameplay:**
- Player movement and jumping validated through manual play only
- Combat system (player attack, enemy damage) verified through gameplay
- Item collection system confirmed via visual feedback
- Plant bullet mechanics confirmed via observation
- Death/respawn flow partially tested

**Missing Edge Cases:**
- What happens if player takes damage while dodging?
- What happens if attack and dodge triggered simultaneously?
- What happens if multiple items overlap?
- What happens if plant bullet hits while player dodging?
- What happens if player falls off world (no boundary checks)?
- What happens if enemy falls off world?
- Does score persist through death/respawn?
- Do boost effects persist through respawn?

**Recommended Test Suite Priority:**
1. Player damage system with invincibility windows
2. Item collection and boost application
3. Plant enemy bullet generation and direction
4. Registry state persistence
5. Level progression and respawn

---

*Testing analysis: 2026-03-01*
