import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { InputManager } from '../input/InputManager';
import type { InputState } from '../input/InputManager';

// ─── Feel Constants ────────────────────────────────────────────────────────────
//
// These numbers were chosen to feel good for a 10-year-old:
//   • Generous coyote time so you can still jump a moment after walking off a ledge
//   • Generous jump buffer so pressing jump just before landing still works
//   • Wall slide is slow (sticky) so the player has time to react
//   • Wall jump lock gives a satisfying arc before control is returned
//   • Variable jump height makes tap = hop, hold = full jump
// ─────────────────────────────────────────────────────────────────────────────
const COYOTE_TIME     = 100;  // ms: grace period after leaving floor
const JUMP_BUFFER     = 150;  // ms: early jump press still registers on landing
const WALL_SLIDE_SPD  = 80;   // px/s: max fall speed when sliding on a wall
const WALL_JUMP_PUSH  = 180;  // px/s: horizontal kick-off from wall
const WALL_JUMP_LOCK  = 200;  // ms: period where player can't override wall-jump velocity
const JUMP_CUT_VEL    = -200; // px/s: velocity cap when jump button released early (small hop)

export class Player extends Phaser.Physics.Arcade.Sprite {
  // ── Input ──────────────────────────────────────────────────────────────────
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keyX!: Phaser.Input.Keyboard.Key;
  private keyC!: Phaser.Input.Keyboard.Key;
  private inputManager!: InputManager;
  private inputState!: InputState;

  // ── Jump state ─────────────────────────────────────────────────────────────
  private canDoubleJump: boolean = false;
  private hasDoubleJumped: boolean = false;
  /** Timestamp of the last frame where the player was on the floor */
  private lastOnFloor: number = 0;
  /** Timestamp of the last jump-key press (for jump buffering) */
  private jumpBufferTimer: number = 0;

  // ── Wall state ─────────────────────────────────────────────────────────────
  /** Whether the player is currently sliding against a wall (and NOT on the floor) */
  private isOnWall: boolean = false;
  /**
   * Which wall: -1 = left wall (body.blocked.left), +1 = right wall (body.blocked.right)
   * 0 = no wall.
   */
  private wallSide: number = 0;
  /** Timestamp of the last wall jump (used to suppress horizontal input briefly) */
  private wallJumpTime: number = 0;

  // ── Attack / dodge ─────────────────────────────────────────────────────────
  private isAttacking: boolean = false;
  private canAttack: boolean = true;
  private attackHitbox: Phaser.GameObjects.Rectangle | null = null;
  private isDodging: boolean = false;
  private canDodge: boolean = true;
  private dodgeDirection: number = 1;

  // ── Health / invincibility ─────────────────────────────────────────────────
  private isInvincible: boolean = false;
  private health: number;
  private readonly maxHealth: number;

  // ── Visual state ───────────────────────────────────────────────────────────
  private facingRight: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-idle');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Physics body: 20×28 in local sprite space → 40×56 px in world (at scale 2)
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(20, 28);
    body.setOffset(6, 4);

    this.setCollideWorldBounds(true);
    this.setScale(2);

    this.maxHealth = GAME_CONFIG.PLAYER.MAX_HEALTH;
    this.health = scene.registry.get('health') as number || this.maxHealth;

    this.setupInput();
    this.inputManager = new InputManager(scene);
    // Provide a safe default so inputState is never undefined before first update()
    this.inputState = { left: false, right: false, jump: false, jumpHeld: false, attack: false, dodge: false };
    this.play('player-idle-anim');
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;

    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.keyW = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyA = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keyD = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keyX = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.keyC = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
  }

  // ── Main update ─────────────────────────────────────────────────────────────

  update(): void {
    // 0. Refresh unified input state once per frame.
    this.inputState = this.inputManager.getState(
      this.cursors, this.keyW, this.keyA, this.keyD, this.keyX, this.keyC, this.scene,
    );

    // 1. Always capture jump press for buffering — even during dodge/attack.
    if (this.inputState.jump) {
      this.jumpBufferTimer = this.scene.time.now;
    }

    // 2. Variable jump height: if jump key released while rising fast → cut velocity.
    //    This gives a small hop on tap vs a full jump on hold.
    this.handleVariableJump();

    // 3. Dodge takes full control of horizontal velocity.
    if (this.isDodging) {
      this.setVelocityX(this.dodgeDirection * GAME_CONFIG.PLAYER.DODGE_VELOCITY);
      this.updateAnimations();
      return;
    }

    // 4. During attack, briefly slow down (but still let gravity/jump work after).
    if (this.isAttacking) {
      const vx = this.body?.velocity.x ?? 0;
      this.setVelocityX(vx * 0.8);
      return;
    }

    this.handleMovement();
    this.handleWallSlide();
    this.handleJump();
    this.handleAttack();
    this.handleDodge();
    this.updateAnimations();
  }

  // ── Movement ────────────────────────────────────────────────────────────────

  private handleMovement(): void {
    const speed = GAME_CONFIG.PLAYER.SPEED;
    const now   = this.scene.time.now;

    // For WALL_JUMP_LOCK ms after a wall jump, we give the jump its natural arc
    // without overriding velocity — but we still update facing direction.
    const inWallJumpLock = now - this.wallJumpTime < WALL_JUMP_LOCK;

    const leftDown  = this.inputState.left;
    const rightDown = this.inputState.right;

    if (inWallJumpLock) {
      // Let the wall-jump momentum carry; only update the sprite facing.
      if (leftDown)       { this.facingRight = false; this.setFlipX(true);  }
      else if (rightDown) { this.facingRight = true;  this.setFlipX(false); }
    } else {
      if (leftDown) {
        this.setVelocityX(-speed);
        this.facingRight = false;
        this.setFlipX(true);
      } else if (rightDown) {
        this.setVelocityX(speed);
        this.facingRight = true;
        this.setFlipX(false);
      } else {
        this.setVelocityX(0);
      }
    }
  }

  // ── Wall slide detection ────────────────────────────────────────────────────

  private handleWallSlide(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    if (body.onFloor()) {
      this.isOnWall = false;
      this.wallSide = 0;
      return;
    }

    if (body.blocked.left) {
      this.isOnWall = true;
      this.wallSide = -1;
    } else if (body.blocked.right) {
      this.isOnWall = true;
      this.wallSide = 1;
    } else {
      this.isOnWall = false;
      this.wallSide = 0;
    }

    // Slow the slide so the player has time to react and plan the next jump.
    if (this.isOnWall && body.velocity.y > WALL_SLIDE_SPD) {
      this.setVelocityY(WALL_SLIDE_SPD);
    }
  }

  // ── Jump (normal + coyote + buffered + wall + double) ──────────────────────

  private handleJump(): void {
    const body  = this.body as Phaser.Physics.Arcade.Body;
    const now   = this.scene.time.now;
    const onFloor = body.onFloor();

    // Track the last moment we were on the floor for coyote time.
    if (onFloor) {
      this.lastOnFloor       = now;
      this.canDoubleJump     = true;
      this.hasDoubleJumped   = false;
    }

    // Is there a buffered jump press?
    const jumpBuffered = now - this.jumpBufferTimer < JUMP_BUFFER;
    if (!jumpBuffered) return;

    // Coyote window: recently left the floor without jumping.
    const coyoteOpen = !onFloor && now - this.lastOnFloor < COYOTE_TIME;

    if (onFloor || coyoteOpen) {
      // ── Normal (or coyote) jump ──────────────────────────────────────────
      this.setVelocityY(GAME_CONFIG.PLAYER.JUMP_VELOCITY);
      this.jumpBufferTimer = 0;   // consume the buffer
      this.lastOnFloor     = 0;   // close coyote window
      this.canDoubleJump   = true;
      this.hasDoubleJumped = false;

    } else if (this.isOnWall) {
      // ── Wall jump ────────────────────────────────────────────────────────
      //    Push AWAY from the wall with JUMP_VELOCITY upward.
      //    wallSide: -1=left wall → kick right (+X); +1=right wall → kick left (-X)
      this.setVelocityY(GAME_CONFIG.PLAYER.JUMP_VELOCITY);
      this.setVelocityX(-this.wallSide * WALL_JUMP_PUSH);
      this.wallJumpTime   = now;      // start the lock timer
      this.isOnWall       = false;
      this.jumpBufferTimer = 0;
      this.canDoubleJump   = true;
      this.hasDoubleJumped = false;

      // Face away from the wall.
      this.facingRight = (this.wallSide < 0);   // left wall → face right
      this.setFlipX(!this.facingRight);

      this.play('player-wall-jump-anim', true);

    } else if (this.canDoubleJump && !this.hasDoubleJumped) {
      // ── Double jump ──────────────────────────────────────────────────────
      this.setVelocityY(GAME_CONFIG.PLAYER.DOUBLE_JUMP_VELOCITY);
      this.hasDoubleJumped = true;
      this.canDoubleJump   = false;
      this.jumpBufferTimer  = 0;
      this.play('player-double-jump-anim', true);
    }
  }

  // ── Variable jump height ────────────────────────────────────────────────────
  //
  // If the player taps jump quickly instead of holding it, we cap the upward
  // velocity at JUMP_CUT_VEL (e.g. -200 px/s) which results in a shorter hop.
  // Full jump: hold button → reaches full JUMP_VELOCITY apex (~100 px).
  // Short hop:  tap button  → velocity cut to -200 → apex ~25 px.
  // ─────────────────────────────────────────────────────────────────────────

  private handleVariableJump(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.onFloor()) return;

    const jumpHeld = this.inputState.jumpHeld;

    if (!jumpHeld && body.velocity.y < JUMP_CUT_VEL) {
      this.setVelocityY(JUMP_CUT_VEL);
    }
  }

  // ── Attack ──────────────────────────────────────────────────────────────────

  private handleAttack(): void {
    if (this.inputState.attack && this.canAttack) {
      this.performAttack();
    }
  }

  private performAttack(): void {
    this.isAttacking = true;
    this.canAttack   = false;

    const attackX = this.x + (this.facingRight
      ? GAME_CONFIG.PLAYER.ATTACK_RANGE
      : -GAME_CONFIG.PLAYER.ATTACK_RANGE);

    this.attackHitbox = this.scene.add.rectangle(attackX, this.y, 40, 40, 0xff0000, 0.3);
    this.scene.physics.add.existing(this.attackHitbox);
    this.scene.events.emit('playerAttack', this.attackHitbox, this.getAttackDamage());

    this.scene.time.delayedCall(100, () => {
      if (this.attackHitbox) {
        this.attackHitbox.destroy();
        this.attackHitbox = null;
      }
    });

    this.scene.time.delayedCall(200, () => { this.isAttacking = false; });

    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.ATTACK_COOLDOWN, () => {
      this.canAttack = true;
    });
  }

  // ── Dodge ───────────────────────────────────────────────────────────────────

  private handleDodge(): void {
    if (this.inputState.dodge && this.canDodge) {
      this.performDodge();
    }
  }

  private performDodge(): void {
    this.isDodging      = true;
    this.canDodge       = false;
    this.isInvincible   = true;
    this.dodgeDirection = this.facingRight ? 1 : -1;

    this.setAlpha(0.5);

    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.DODGE_DURATION, () => {
      this.isDodging    = false;
      this.isInvincible = false;
      this.setAlpha(1);
    });

    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.DODGE_COOLDOWN, () => {
      this.canDodge = true;
    });
  }

  // ── Animation ───────────────────────────────────────────────────────────────

  private updateAnimations(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const now  = this.scene.time.now;

    // During attack we don't override the current animation.
    if (this.isAttacking) return;

    // When the player is currently wall-sliding, show the wall-jump animation
    // and orient them to face away from the wall.
    if (this.isOnWall && !body.onFloor()) {
      // wallSide=-1 (left wall) → face right (flipX false)
      // wallSide=+1 (right wall) → face left (flipX true)
      this.setFlipX(this.wallSide > 0);
      this.play('player-wall-jump-anim', true);
      return;
    }

    // Brief hold after a wall jump: keep the wall-jump animation visible for
    // ~350 ms so the player gets clear feedback that the move registered.
    // (Without this, handleJump sets isOnWall=false before we reach this
    //  method, causing the animation to be overridden on the same frame.)
    if (now - this.wallJumpTime < 350) {
      this.play('player-wall-jump-anim', true);
      return;
    }

    if (!body.onFloor()) {
      if (body.velocity.y < 0) {
        // Rising — only switch to jump-anim if not already playing double-jump
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

  // ── Damage / health ─────────────────────────────────────────────────────────

  public takeDamage(amount: number): void {
    if (this.isInvincible) return;

    const defenseBoost = (this.scene.registry.get('defenseBoost') as number) || 1;
    const actualDamage = Math.round(amount * defenseBoost);

    this.health -= actualDamage;
    this.scene.registry.set('health', this.health);

    this.play('player-hit-anim', true);
    this.setTint(0xff0000);
    this.isInvincible = true;

    this.scene.tweens.add({
      targets: this,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.setAlpha(1);
        this.clearTint();
      },
    });

    this.scene.time.delayedCall(GAME_CONFIG.PLAYER.INVINCIBILITY_DURATION, () => {
      this.isInvincible = false;
    });

    this.scene.events.emit('playerDamaged', this.health, this.maxHealth);

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

  // ── Getters ─────────────────────────────────────────────────────────────────

  public getAttackDamage(): number {
    const boost = (this.scene.registry.get('attackBoost') as number) || 1;
    return Math.round(GAME_CONFIG.PLAYER.ATTACK_DAMAGE * boost);
  }

  public getHealth(): number     { return this.health; }
  public getMaxHealth(): number  { return this.maxHealth; }
  public isPlayerInvincible(): boolean { return this.isInvincible; }

  // Agent 4: expose wall-slide state for visual feedback in GameScene
  public isWallSliding(): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    return this.isOnWall && !body.onFloor() && body.velocity.y > 0;
  }
}
