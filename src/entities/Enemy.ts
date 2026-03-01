import Phaser from 'phaser';

export interface EnemyConfig {
  health: number;
  damage: number;
  speed: number;
  points: number;
  spriteKey: string;
  animPrefix: string;
  scale?: number;
}

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private health: number;
  private damage: number;
  private speed: number;
  private points: number;
  private animPrefix: string;

  private direction: number = -1; // -1 = left, 1 = right
  private patrolDistance: number = 100;
  private startX: number;

  private isHurt: boolean = false;
  private isDead: boolean = false;
  private hurtTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, config: EnemyConfig) {
    super(scene, x, y, config.spriteKey);

    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Setup physics body
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(24, 24);

    // Scale
    this.setScale(config.scale || 2);

    // Store config
    this.health = config.health;
    this.damage = config.damage;
    this.speed = config.speed;
    this.points = config.points;
    this.animPrefix = config.animPrefix;
    this.startX = x;

    // Play idle animation
    this.play(`${this.animPrefix}-idle-anim`, true);
  }

  update(): void {
    if (this.isDead || this.isHurt) return;

    this.patrol();
    this.updateAnimations();
  }

  private patrol(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    // Move in current direction
    this.setVelocityX(this.direction * this.speed);

    // Flip sprite based on direction
    this.setFlipX(this.direction > 0);

    // Change direction at patrol bounds or when hitting walls
    if (this.x < this.startX - this.patrolDistance) {
      this.direction = 1;
    } else if (this.x > this.startX + this.patrolDistance) {
      this.direction = -1;
    }

    // Also change direction if blocked
    if (body.blocked.left) {
      this.direction = 1;
    } else if (body.blocked.right) {
      this.direction = -1;
    }
  }

  private updateAnimations(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (Math.abs(body.velocity.x) > 5) {
      this.play(`${this.animPrefix}-run-anim`, true);
    } else {
      this.play(`${this.animPrefix}-idle-anim`, true);
    }
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;

    this.health -= amount;
    this.isHurt = true;

    // Visual feedback
    this.setTint(0xff0000);
    this.setVelocityX(0);

    // Knockback
    const knockbackDir = this.direction * -1;
    this.setVelocityX(knockbackDir * 100);

    // Cancel previous hurt timer if still pending (prevents stuck state)
    if (this.hurtTimer) {
      this.hurtTimer.remove(false);
    }

    // Recover from hurt
    this.hurtTimer = this.scene.time.delayedCall(300, () => {
      this.isHurt = false;
      this.clearTint();
      this.hurtTimer = null;
    });

    // Check for death
    if (this.health <= 0) {
      if (this.hurtTimer) {
        this.hurtTimer.remove(false);
        this.hurtTimer = null;
      }
      this.die();
    }
  }

  private die(): void {
    this.isDead = true;
    this.setVelocityX(0);
    this.setVelocityY(-200); // Pop up effect

    // Disable collision
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    // Fade out and destroy
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.scene.events.emit('enemyKilled', this.points);
        this.destroy();
      }
    });
  }

  public getDamage(): number {
    return this.damage;
  }

  public isEnemyDead(): boolean {
    return this.isDead;
  }

  public setPatrolDistance(distance: number): void {
    this.patrolDistance = distance;
  }
}

// Specific enemy types factory
export class EnemyFactory {
  static createMushroom(scene: Phaser.Scene, x: number, y: number): Enemy {
    return new Enemy(scene, x, y, {
      health: 30,
      damage: 10,
      speed: 50,
      points: 50,
      spriteKey: 'mushroom-idle',
      animPrefix: 'mushroom',
      scale: 2,
    });
  }

  static createChicken(scene: Phaser.Scene, x: number, y: number): Enemy {
    return new Enemy(scene, x, y, {
      health: 40,
      damage: 15,
      speed: 75,
      points: 75,
      spriteKey: 'chicken-idle',
      animPrefix: 'chicken',
      scale: 2,
    });
  }

  static createRino(scene: Phaser.Scene, x: number, y: number): Enemy {
    // Using Rino as mini-boss with higher health and speed
    return new Enemy(scene, x, y, {
      health: 120,
      damage: 20,
      speed: 90,
      points: 300,
      spriteKey: 'rino-idle',
      animPrefix: 'rino',
      scale: 2,
    });
  }

  static createRadish(scene: Phaser.Scene, x: number, y: number): Enemy {
    return new Enemy(scene, x, y, {
      health: 40,
      damage: 12,
      speed: 65,
      points: 75,
      spriteKey: 'radish-idle',
      animPrefix: 'radish',
      scale: 2,
    });
  }

  static createPlant(scene: Phaser.Scene, x: number, y: number): PlantEnemy {
    return new PlantEnemy(scene, x, y);
  }
}

// Special Plant enemy that shoots bullets
export class PlantEnemy extends Phaser.Physics.Arcade.Sprite {
  private health: number = 60;
  private damage: number = 15;
  private points: number = 100;
  private isHurt: boolean = false;
  private isDead: boolean = false;
  private hurtTimer: Phaser.Time.TimerEvent | null = null;
  private shootCooldown: boolean = false;
  private detectionRange: number = 280;
  private bullets!: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'plant-idle');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(30, 36);
    body.setAllowGravity(true);

    this.setScale(2);
    this.play('plant-idle-anim', true);

    // Create bullets group
    this.bullets = scene.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      runChildUpdate: true,
    });
  }

  update(playerX?: number, playerY?: number): void {
    if (this.isDead || this.isHurt) return;

    // Check if player is in range and shoot
    if (playerX !== undefined && playerY !== undefined) {
      const distance = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);

      if (distance < this.detectionRange && !this.shootCooldown) {
        this.shoot(playerX, playerY);
      }
    }

    // Cull bullets that leave world bounds
    const bounds = this.scene.physics.world.bounds;
    this.bullets.getChildren().forEach((bullet) => {
      const b = bullet as Phaser.Physics.Arcade.Image;
      if (b.x < bounds.x || b.x > bounds.right || b.y < bounds.y || b.y > bounds.bottom) {
        b.destroy();
      }
    });
  }

  private shoot(targetX: number, targetY: number): void {
    this.shootCooldown = true;

    // Emit warning so GameScene can show "!" indicator
    this.scene.events.emit('plantWarning', this.x, this.y);

    // Play attack animation
    this.play('plant-attack-anim', true);

    // Create bullet after short delay (sync with animation)
    this.scene.time.delayedCall(300, () => {
      if (this.isDead) return;

      const bullet = this.bullets.create(this.x, this.y - 10, 'plant-bullet') as Phaser.Physics.Arcade.Image;
      bullet.setScale(2);

      const body = bullet.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);

      // Calculate direction to player
      const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
      const speed = 200;

      bullet.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );

      // Flip plant to face player
      this.setFlipX(targetX < this.x);
    });

    // Return to idle after attack
    this.scene.time.delayedCall(600, () => {
      if (!this.isDead) {
        this.play('plant-idle-anim', true);
      }
    });

    // Cooldown
    this.scene.time.delayedCall(2200, () => {
      this.shootCooldown = false;
    });
  }

  public takeDamage(amount: number): void {
    if (this.isDead) return;

    this.health -= amount;
    this.isHurt = true;
    this.setTint(0xff0000);

    // Cancel previous hurt timer if still pending
    if (this.hurtTimer) {
      this.hurtTimer.remove(false);
    }

    this.hurtTimer = this.scene.time.delayedCall(300, () => {
      this.isHurt = false;
      this.clearTint();
      this.hurtTimer = null;
    });

    if (this.health <= 0) {
      if (this.hurtTimer) {
        this.hurtTimer.remove(false);
        this.hurtTimer = null;
      }
      this.die();
    }
  }

  private die(): void {
    this.isDead = true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 500,
      onComplete: () => {
        this.scene.events.emit('enemyKilled', this.points);
        this.bullets.destroy(true);
        this.destroy();
      }
    });
  }

  public getDamage(): number {
    return this.damage;
  }

  public isEnemyDead(): boolean {
    return this.isDead;
  }

  public getBullets(): Phaser.Physics.Arcade.Group {
    return this.bullets;
  }

  public getBulletDamage(): number {
    return 10;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RinoBoss — 3-Phase Mini-Boss
// ─────────────────────────────────────────────────────────────────────────────

type BossState = 'IDLE' | 'PATROL' | 'WIND_UP' | 'CHARGE' | 'RECOVER' | 'GROUND_POUND' | 'DEAD';

export class RinoBoss extends Phaser.Physics.Arcade.Sprite {
  // ── Core stats ─────────────────────────────────────────────────────────────
  private readonly MAX_HP: number;
  private currentHP: number;
  private phase: number = 1;

  // Phase-dependent stats
  private readonly PHASE_SPEED    = [80,  130, 160];
  private readonly PHASE_DAMAGE   = [20,   25,  30];
  private readonly PHASE_CHARGE_CD = [4000, 2500, 1500];

  // ── State machine ──────────────────────────────────────────────────────────
  private bossState: BossState = 'IDLE';
  private direction: number = -1;   // -1 left, 1 right
  private patrolDistance: number = 150;
  private startX: number;
  private chargeTimer: number = 0;
  private groundPoundTimer: number = 0;
  private stateTimer: number = 0;   // time when current state started (scene time)

  // ── Flags ──────────────────────────────────────────────────────────────────
  private isHurt: boolean = false;
  private isDead: boolean = false;
  private aggroTriggered: boolean = false;
  private groundPoundFalling: boolean = false;
  private groundPoundLanded: boolean = false;

  // ── Visual objects ─────────────────────────────────────────────────────────
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpBarWidth: number = 70;
  private sparkEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private shadowCircle?: Phaser.GameObjects.Ellipse;

  // ── Stomp resistance ───────────────────────────────────────────────────────
  private readonly STOMP_MULTIPLIER = 0.3;

  constructor(scene: Phaser.Scene, x: number, y: number, maxHP: number = 300) {
    super(scene, x, y, 'rino-idle');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.MAX_HP = maxHP;
    this.currentHP = maxHP;
    this.startX = x;

    // Physics body
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(36, 28);
    body.setOffset(8, 4);

    // Boss scale — intimidating
    this.setScale(3.0);
    this.setDepth(5);

    // Start idle animation
    this.play('rino-idle-anim', true);

    // HP bar
    this.createHPBar();

    // Spawn entrance: camera shake + zoom
    this.spawnEntrance();

    console.log('[RinoBoss] Spawned at', x, y, '— HP:', this.currentHP);
  }

  // ── Public API (required for tests) ────────────────────────────────────────

  public getPhase(): number { return this.phase; }
  public isCharging(): boolean { return this.bossState === 'CHARGE'; }
  public getMaxHP(): number { return this.MAX_HP; }
  public getCurrentHP(): number { return this.currentHP; }

  // ── Damage handling ─────────────────────────────────────────────────────────

  public takeDamage(amount: number, source?: string): void {
    if (this.isDead) return;

    // Stomp resistance
    const actualDamage = source === 'stomp'
      ? Math.round(amount * this.STOMP_MULTIPLIER)
      : amount;

    this.currentHP = Math.max(0, this.currentHP - actualDamage);

    // Phase transitions
    if (this.currentHP <= 100 && this.phase < 3) {
      this.enterPhase(3);
    } else if (this.currentHP <= 200 && this.phase < 2) {
      this.enterPhase(2);
    }

    // Visual hurt feedback (only if not in test mode or already charging)
    if (!this.isDead) {
      this.isHurt = true;
      this.setTint(0xffffff);
      this.scene.time.delayedCall(200, () => {
        if (!this.isDead) {
          this.isHurt = false;
          this.applyPhaseTint();
        }
      });
    }

    if (this.currentHP <= 0) {
      this.die();
    }
  }

  // ── Phase transitions ───────────────────────────────────────────────────────

  private enterPhase(newPhase: number): void {
    if (this.phase === newPhase) return;
    this.phase = newPhase;

    console.log(`[RinoBoss] Entering Phase ${newPhase}`);

    if (newPhase === 2) {
      this.setTint(0xff6666);
      this.scene.cameras.main.flash(300, 255, 100, 100);
      this.showFloatingText('💢 WÜTEND!', '#ff6666');
    } else if (newPhase === 3) {
      this.setTint(0xff0000);
      this.scene.cameras.main.shake(400, 0.01);
      this.scene.cameras.main.flash(400, 255, 50, 50);
      this.showFloatingText('💢 RASEND!', '#ff0000');
      this.startSparkEmitter();
    }
  }

  private applyPhaseTint(): void {
    if (this.phase === 2) this.setTint(0xff6666);
    else if (this.phase === 3) this.setTint(0xff0000);
    else this.clearTint();
  }

  // ── Spawn entrance ──────────────────────────────────────────────────────────

  private spawnEntrance(): void {
    // Slight delay so the scene is fully ready
    this.scene.time.delayedCall(100, () => {
      if (!this.scene || !this.scene.cameras) return;
      this.scene.cameras.main.shake(500, 0.012);
      this.scene.cameras.main.zoomTo(1.1, 200, 'Linear', true,
        (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
          if (progress === 1) {
            this.scene.cameras.main.zoomTo(1.0, 400, 'Linear', true);
          }
        }
      );
    });
  }

  // ── HP Bar ──────────────────────────────────────────────────────────────────

  private createHPBar(): void {
    const barH = 6;
    this.hpBarBg   = this.scene.add.rectangle(this.x, this.y - 55, this.hpBarWidth + 2, barH + 2, 0x000000, 0.8);
    this.hpBarFill = this.scene.add.rectangle(this.x, this.y - 55, this.hpBarWidth, barH, 0xff2222);
    this.hpBarBg.setDepth(6);
    this.hpBarFill.setDepth(7);
  }

  private updateHPBar(): void {
    if (!this.hpBarBg || !this.hpBarFill || !this.active) return;
    const ratio = Math.max(0, this.currentHP / this.MAX_HP);
    const barX = this.x - this.hpBarWidth / 2 + (this.hpBarWidth * ratio) / 2;
    this.hpBarBg.setPosition(this.x, this.y - 55);
    this.hpBarFill.setPosition(barX, this.y - 55);
    this.hpBarFill.setDisplaySize(this.hpBarWidth * ratio, 6);

    // Color shifts: green → yellow → red
    const color = ratio > 0.5 ? 0x44ff44 : ratio > 0.25 ? 0xffaa00 : 0xff2222;
    this.hpBarFill.setFillStyle(color);
  }

  // ── Aggro detection ─────────────────────────────────────────────────────────

  private checkAggro(playerX: number, playerY: number): void {
    if (this.bossState !== 'IDLE') return;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
    if (dist < 400) {
      this.bossState = 'PATROL';
      if (!this.aggroTriggered) {
        this.aggroTriggered = true;
        this.showFloatingText('⚠️ MINI-BOSS', '#FFD700');
        this.scene.cameras.main.shake(300, 0.008);
      }
    }
  }

  // ── State machine update ─────────────────────────────────────────────────────

  update(playerX?: number, playerY?: number): void {
    if (this.isDead) return;
    if (!this.active) return;

    const now = this.scene.time.now;
    const body = this.body as Phaser.Physics.Arcade.Body;
    const phaseIdx = this.phase - 1;
    const speed = this.PHASE_SPEED[phaseIdx];
    const chargeCooldown = this.PHASE_CHARGE_CD[phaseIdx];

    // Aggro check
    if (playerX !== undefined && playerY !== undefined) {
      this.checkAggro(playerX, playerY);
    }

    // ── Detect landing from ground pound ─────────────────────────────────────
    const isOnFloor = body.onFloor();
    if (this.groundPoundFalling && isOnFloor && !this.groundPoundLanded) {
      this.groundPoundLanded = true;
      this.onGroundPoundLand(playerX, playerY);
    }

    switch (this.bossState) {

      case 'IDLE':
        this.setVelocityX(0);
        this.play('rino-idle-anim', true);
        break;

      case 'PATROL': {
        // Move and patrol (skip if in hurt flash)
        if (!this.isHurt) {
          this.setVelocityX(this.direction * speed);
        }
        this.setFlipX(this.direction > 0);
        this.play('rino-run-anim', true);

        // Reverse at patrol bounds or walls
        if (this.x < this.startX - this.patrolDistance) this.direction = 1;
        else if (this.x > this.startX + this.patrolDistance) this.direction = -1;
        if (body.blocked.left)  this.direction = 1;
        if (body.blocked.right) this.direction = -1;

        // Check if it's time for a charge (not while being knocked back)
        if (!this.isHurt && now - this.chargeTimer > chargeCooldown) {
          this.startWindUp(playerX);
        }

        // Phase 3: ground pound
        if (this.phase === 3 && now - this.groundPoundTimer > 6000) {
          this.startGroundPound();
        }
        break;
      }

      case 'WIND_UP':
        // Wait in WIND_UP for 600ms (handled by delayedCall in startWindUp)
        this.setVelocityX(0);
        this.play('rino-idle-anim', true);
        break;

      case 'CHARGE': {
        // Check max charge duration (1.5s)
        if (now - this.stateTimer > 1500) {
          this.enterRecover();
          return;
        }
        // Check wall collision
        if (body.blocked.left || body.blocked.right) {
          this.enterRecover();
          return;
        }
        // Keep charging velocity (set in startCharge)
        break;
      }

      case 'RECOVER':
        // Handled by delayedCall — just stay still
        this.setVelocityX(0);
        this.play('rino-idle-anim', true);
        break;

      case 'GROUND_POUND': {
        // Fast fall once we've reached the apex
        if (body.velocity.y >= 0 && !this.groundPoundFalling && !isOnFloor) {
          this.groundPoundFalling = true;
          const gbody = this.body as Phaser.Physics.Arcade.Body;
          gbody.setGravityY(1500);
        }
        break;
      }

      case 'DEAD':
        break;
    }

    // Update HP bar position every frame
    this.updateHPBar();

    // Update spark emitter position
    if (this.sparkEmitter) {
      this.sparkEmitter.setPosition(this.x, this.y);
    }

    // Update shadow circle during ground pound
    if (this.groundPoundFalling && this.shadowCircle && !this.groundPoundLanded) {
      // Keep shadow at current boss x, at ground level
      this.shadowCircle.setPosition(this.x, 542);
    }
  }

  // ── Wind-up before charge ───────────────────────────────────────────────────

  private startWindUp(playerX?: number): void {
    this.bossState = 'WIND_UP';
    this.chargeTimer = this.scene.time.now;
    this.setVelocityX(0);

    // Face the player
    if (playerX !== undefined) {
      this.direction = playerX < this.x ? -1 : 1;
      this.setFlipX(this.direction > 0);
    }

    // "!!" warning text
    const warnText = this.scene.add.text(this.x, this.y - 70, '!!', {
      fontSize: '28px',
      color: '#ff0000',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    // White flash
    this.setTint(0xffffff);
    this.scene.time.delayedCall(150, () => { if (!this.isDead) this.applyPhaseTint(); });

    // After 600ms wind-up → charge
    this.scene.time.delayedCall(600, () => {
      warnText.destroy();
      if (!this.isDead && this.bossState === 'WIND_UP') {
        this.startCharge();
      }
    });
  }

  // ── Charge attack ───────────────────────────────────────────────────────────

  private startCharge(): void {
    this.bossState = 'CHARGE';
    this.stateTimer = this.scene.time.now;

    const chargeSpeed = 400;
    this.setVelocityX(this.direction * chargeSpeed);
    this.setFlipX(this.direction > 0);
    this.play('rino-run-anim', true);

    // Phase 3: screen shake on each charge
    if (this.phase === 3) {
      this.scene.cameras.main.shake(150, 0.005);
    }
  }

  private enterRecover(): void {
    this.bossState = 'RECOVER';
    this.setVelocityX(0);

    // Stun: face opposite direction
    this.direction = this.direction * -1;

    this.scene.time.delayedCall(300, () => {
      if (!this.isDead) {
        this.bossState = 'PATROL';
        this.chargeTimer = this.scene.time.now; // reset charge cooldown
      }
    });
  }

  // ── Ground pound (Phase 3 only) ─────────────────────────────────────────────

  private startGroundPound(): void {
    this.bossState = 'GROUND_POUND';
    this.groundPoundTimer = this.scene.time.now;
    this.groundPoundFalling = false;
    this.groundPoundLanded = false;

    // Create shadow circle on floor
    this.shadowCircle = this.scene.add.ellipse(this.x, 542, 80, 20, 0x000000, 0.4);
    this.shadowCircle.setDepth(3);

    // Jump!
    this.setVelocityY(-500);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(0); // reset custom gravity first
  }

  private onGroundPoundLand(playerX?: number, playerY?: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(0); // Reset extra gravity

    // Destroy shadow
    if (this.shadowCircle) {
      this.shadowCircle.destroy();
      this.shadowCircle = undefined;
    }

    // Screen shake
    this.scene.cameras.main.shake(300, 0.01);

    // Dust particles
    this.spawnDustParticles(this.x, this.y + 40);

    // Damage player if nearby
    if (playerX !== undefined && playerY !== undefined) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY);
      if (dist < 80) {
        this.scene.events.emit('bossGroundPoundHit', this.PHASE_DAMAGE[this.phase - 1]);
      }
    }

    // Recover
    this.scene.time.delayedCall(400, () => {
      if (!this.isDead) {
        this.bossState = 'PATROL';
        this.groundPoundTimer = this.scene.time.now;
        this.groundPoundFalling = false;
      }
    });
  }

  // ── Death sequence ──────────────────────────────────────────────────────────

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;
    this.bossState = 'DEAD';

    console.log('[RinoBoss] Dying — death sequence');

    // Stop movement
    this.setVelocityX(0);
    this.setVelocityY(0);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    // Stop spark emitter
    if (this.sparkEmitter) {
      this.sparkEmitter.stop();
    }

    // Destroy shadow if any
    if (this.shadowCircle) {
      this.shadowCircle.destroy();
    }

    // 3 explosion bursts
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 120, () => {
        if (!this.scene) return;
        const ox = (Math.random() - 0.5) * 40;
        const oy = (Math.random() - 0.5) * 30;
        this.spawnExplosionParticles(this.x + ox, this.y + oy);
      });
    }

    // Screen effects
    this.scene.time.delayedCall(200, () => {
      if (!this.scene?.cameras) return;
      this.scene.cameras.main.shake(800, 0.015);
      this.scene.cameras.main.zoomTo(1.15, 150, 'Linear', true,
        (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
          if (progress === 1) {
            this.scene.cameras.main.zoomTo(1.0, 300, 'Linear', true);
          }
        }
      );
    });

    // "BOSS BESIEGT! 🏆" popup
    this.scene.time.delayedCall(400, () => {
      if (!this.scene) return;
      const txt = this.scene.add.text(
        this.x, this.y - 60, 'BOSS BESIEGT! 🏆', {
          fontSize: '32px',
          color: '#FFD700',
          stroke: '#000000',
          strokeThickness: 5,
        }
      ).setOrigin(0.5).setDepth(15);

      this.scene.tweens.add({
        targets: txt,
        y: txt.y - 80,
        alpha: 0,
        duration: 2500,
        ease: 'Power2',
        onComplete: () => { txt.destroy(); },
      });

      // Emit bossDeath event with position for GameScene to handle
      this.scene.events.emit('bossDeath', this.x, this.y);
    });

    // Emit score & destroy
    this.scene.time.delayedCall(500, () => {
      if (!this.scene) return;
      // Emit enemyKilled for 500 points
      this.scene.events.emit('enemyKilled', 500);

      // Remove HP bar
      if (this.hpBarBg)   { this.hpBarBg.destroy(); }
      if (this.hpBarFill) { this.hpBarFill.destroy(); }
    });

    // Fade out and destroy
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 800,
      delay: 600,
      onComplete: () => {
        this.destroy();
      },
    });
  }

  // ── Visual helpers ──────────────────────────────────────────────────────────

  private showFloatingText(text: string, color: string): void {
    if (!this.scene) return;
    const t = this.scene.add.text(this.x, this.y - 80, text, {
      fontSize: '22px',
      color,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(12);

    this.scene.tweens.add({
      targets: t,
      y: t.y - 50,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
      onComplete: () => { t.destroy(); },
    });
  }

  private startSparkEmitter(): void {
    // Simple rectangle-based spark particles (no external texture needed)
    try {
      this.sparkEmitter = this.scene.add.particles(this.x, this.y, 'rino-idle', {
        speed: { min: 40, max: 120 },
        scale: { start: 0.5, end: 0 },
        alpha: { start: 1, end: 0 },
        lifespan: 400,
        frequency: 80,
        tint: [0xff4400, 0xff8800, 0xffff00],
        quantity: 2,
        angle: { min: 0, max: 360 },
      });
      this.sparkEmitter.setDepth(8);
    } catch {
      // Particle emitter is cosmetic — non-fatal if it fails
      console.warn('[RinoBoss] Could not start spark emitter');
    }
  }

  private spawnExplosionParticles(x: number, y: number): void {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 80 + Math.random() * 100;
      const colors = [0xFF4400, 0xFF8800, 0xFFFF00, 0xFFFFFF];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const rect = this.scene.add.rectangle(x, y, 8, 8, color).setDepth(14);
      this.scene.tweens.add({
        targets:  rect,
        x:        x + Math.cos(angle) * speed,
        y:        y + Math.sin(angle) * speed,
        alpha:    0,
        scaleX:   0,
        scaleY:   0,
        duration: 500 + Math.random() * 300,
        ease:     'Power2',
        onComplete: () => { rect.destroy(); },
      });
    }
  }

  private spawnDustParticles(x: number, y: number): void {
    for (let i = 0; i < 8; i++) {
      const side = (Math.random() - 0.5) * 2;
      const dust = this.scene.add.rectangle(
        x + side * 20 * Math.random(), y - 4, 6, 6, 0xddddcc, 0.9,
      ).setDepth(6);
      this.scene.tweens.add({
        targets:  dust,
        x:        dust.x + side * (30 + Math.random() * 30),
        y:        dust.y - 15 - Math.random() * 10,
        alpha:    0,
        scaleX:   0.2,
        scaleY:   0.2,
        duration: 400 + Math.random() * 200,
        ease:     'Power2',
        onComplete: () => { dust.destroy(); },
      });
    }
  }

  // ── Required compatibility with Enemy interface ─────────────────────────────

  public getDamage(): number {
    return this.PHASE_DAMAGE[this.phase - 1];
  }

  public isEnemyDead(): boolean {
    return this.isDead;
  }

  public setPatrolDistance(distance: number): void {
    this.patrolDistance = distance;
  }
}
