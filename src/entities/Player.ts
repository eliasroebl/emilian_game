import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyX!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;

  private canDoubleJump: boolean = false;
  private hasDoubleJumped: boolean = false;

  private isDodging: boolean = false;
  private canDodge: boolean = true;
  private dodgeDirection: number = 1;

  private isAttacking: boolean = false;
  private canAttack: boolean = true;
  private attackHitbox: Phaser.GameObjects.Rectangle | null = null;

  private isInvincible: boolean = false;
  private health: number;
  private maxHealth: number;

  private facingRight: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-idle');

    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Setup physics body
    this.setCollideWorldBounds(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 28);
    body.setOffset(6, 4);

    // Scale up the player a bit for visibility
    this.setScale(2);

    // Initialize health
    this.maxHealth = GAME_CONFIG.PLAYER.MAX_HEALTH;
    this.health = this.scene.registry.get('health') || this.maxHealth;

    // Setup input
    this.setupInput();

    // Play idle animation
    this.play('player-idle-anim');
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;

    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.keyW = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyS = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyD = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyX = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyC = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
  }

  update(): void {
    if (this.isDodging) {
      // Continue dodge movement
      this.setVelocityX(this.dodgeDirection * GAME_CONFIG.PLAYER.DODGE_VELOCITY);
      return;
    }

    if (this.isAttacking) {
      // Slow down during attack
      this.setVelocityX(this.body?.velocity.x ? this.body.velocity.x * 0.8 : 0);
      return;
    }

    this.handleMovement();
    this.handleJump();
    this.handleAttack();
    this.handleDodge();
    this.updateAnimations();
  }

  private handleMovement(): void {
    const speed = GAME_CONFIG.PLAYER.SPEED;
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.cursors.left.isDown || this.keyA.isDown) {
      this.setVelocityX(-speed);
      this.facingRight = false;
      this.setFlipX(true);
    } else if (this.cursors.right.isDown || this.keyD.isDown) {
      this.setVelocityX(speed);
      this.facingRight = true;
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    // Reset double jump when on ground
    if (body.onFloor()) {
      this.canDoubleJump = true;
      this.hasDoubleJumped = false;
    }
  }

  private handleJump(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.space) ||
                        Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
                        Phaser.Input.Keyboard.JustDown(this.keyW);

    if (jumpPressed) {
      if (body.onFloor()) {
        // Normal jump
        this.setVelocityY(GAME_CONFIG.PLAYER.JUMP_VELOCITY);
        this.canDoubleJump = true;
      } else if (this.canDoubleJump && !this.hasDoubleJumped) {
        // Double jump
        this.setVelocityY(GAME_CONFIG.PLAYER.DOUBLE_JUMP_VELOCITY);
        this.hasDoubleJumped = true;
        this.canDoubleJump = false;
        this.play('player-double-jump-anim', true);
      }
    }
  }

  private handleAttack(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keyX) && this.canAttack) {
      this.performAttack();
    }
  }

  private performAttack(): void {
    this.isAttacking = true;
    this.canAttack = false;

    // Create attack hitbox in front of player
    const attackX = this.x + (this.facingRight ? GAME_CONFIG.PLAYER.ATTACK_RANGE : -GAME_CONFIG.PLAYER.ATTACK_RANGE);
    this.attackHitbox = this.scene.add.rectangle(attackX, this.y, 40, 40, 0xff0000, 0.3);
    this.scene.physics.add.existing(this.attackHitbox);

    // Emit attack event for GameScene to handle
    this.scene.events.emit('playerAttack', this.attackHitbox, this.getAttackDamage());

    // Remove hitbox after short time
    this.scene.time.delayedCall(100, () => {
      if (this.attackHitbox) {
        this.attackHitbox.destroy();
        this.attackHitbox = null;
      }
    });

    // End attack state
    this.scene.time.delayedCall(200, () => {
      this.isAttacking = false;
    });

    // Attack cooldown
    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.ATTACK_COOLDOWN, () => {
      this.canAttack = true;
    });
  }

  private handleDodge(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keyC) && this.canDodge) {
      this.performDodge();
    }
  }

  private performDodge(): void {
    this.isDodging = true;
    this.canDodge = false;
    this.isInvincible = true;

    // Dodge in facing direction
    this.dodgeDirection = this.facingRight ? 1 : -1;

    // Visual feedback - flash/fade
    this.setAlpha(0.5);

    // End dodge after duration
    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.DODGE_DURATION, () => {
      this.isDodging = false;
      this.isInvincible = false;
      this.setAlpha(1);
    });

    // Dodge cooldown
    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.DODGE_COOLDOWN, () => {
      this.canDodge = true;
    });
  }

  private updateAnimations(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (this.isAttacking) {
      // We don't have an attack animation in the current assets
      // Could add a visual effect here
      return;
    }

    if (!body.onFloor()) {
      if (body.velocity.y < 0) {
        if (!this.hasDoubleJumped) {
          this.play('player-jump-anim', true);
        }
      } else {
        this.play('player-fall-anim', true);
      }
    } else if (Math.abs(body.velocity.x) > 10) {
      this.play('player-run-anim', true);
    } else {
      this.play('player-idle-anim', true);
    }
  }

  public takeDamage(amount: number): void {
    if (this.isInvincible) return;

    // Apply defense boost
    const defenseBoost = this.scene.registry.get('defenseBoost') || 1;
    const actualDamage = Math.round(amount * defenseBoost);

    this.health -= actualDamage;
    this.scene.registry.set('health', this.health);

    // Visual feedback
    this.play('player-hit-anim', true);
    this.setTint(0xff0000);

    // Invincibility frames
    this.isInvincible = true;

    // Flash effect
    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.setAlpha(1);
        this.clearTint();
      }
    });

    // End invincibility
    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.INVINCIBILITY_DURATION, () => {
      this.isInvincible = false;
    });

    // Emit damage event
    this.scene.events.emit('playerDamaged', this.health, this.maxHealth);

    // Check for death
    if (this.health <= 0) {
      this.die();
    }
  }

  private die(): void {
    this.scene.events.emit('playerDied');
  }

  public heal(amount: number): void {
    this.health = Math.min(this.health + amount, this.maxHealth);
    this.scene.registry.set('health', this.health);
    this.scene.events.emit('playerHealed', this.health, this.maxHealth);
  }

  public getAttackDamage(): number {
    const attackBoost = this.scene.registry.get('attackBoost') || 1;
    return Math.round(GAME_CONFIG.PLAYER.ATTACK_DAMAGE * attackBoost);
  }

  public getHealth(): number {
    return this.health;
  }

  public getMaxHealth(): number {
    return this.maxHealth;
  }

  public isPlayerInvincible(): boolean {
    return this.isInvincible;
  }
}
