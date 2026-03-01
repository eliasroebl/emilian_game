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
      speed: 60,
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
      speed: 80,
      points: 75,
      spriteKey: 'chicken-idle',
      animPrefix: 'chicken',
      scale: 2,
    });
  }

  static createRino(scene: Phaser.Scene, x: number, y: number): Enemy {
    // Using Rino as "Mole" placeholder
    return new Enemy(scene, x, y, {
      health: 50,
      damage: 15,
      speed: 80,
      points: 100,
      spriteKey: 'rino-idle',
      animPrefix: 'rino',
      scale: 2,
    });
  }

  static createRadish(scene: Phaser.Scene, x: number, y: number): Enemy {
    return new Enemy(scene, x, y, {
      health: 40,
      damage: 12,
      speed: 70,
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
  private detectionRange: number = 300;
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
    this.scene.time.delayedCall(2000, () => {
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
