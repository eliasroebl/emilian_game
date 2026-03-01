# Codebase Concerns

**Analysis Date:** 2026-03-01

## Tech Debt

**GameOverScene Not Implemented:**
- Issue: `GameScene.ts` line 408 calls `this.scene.launch('GameOverScene')` but the scene is never defined
- Files: `src/scenes/GameScene.ts`
- Impact: Game crashes on game over; player progression is lost without proper end-of-level state management
- Fix approach: Create `src/scenes/GameOverScene.ts` with score display, restart button, world selection, or level progression logic

**Pause System Configured But Not Implemented:**
- Issue: `CONTROLS.PAUSE` is defined in `GameConfig.ts` but no pause logic exists in any scene
- Files: `src/config/GameConfig.ts`, `src/scenes/GameScene.ts`
- Impact: Players cannot pause during gameplay; no way to handle interruptions or menu access mid-game
- Fix approach: Add pause event listener in `GameScene.create()`, create pause UI overlay, implement pause/unpause toggle

**Multiple World Configs Unused:**
- Issue: `GAME_CONFIG.WORLDS` defines 4 worlds (Earth, Stone, Water, Cloud) but only Earth is loaded
- Files: `src/config/GameConfig.ts`, `src/scenes/MenuScene.ts`, `src/scenes/GameScene.ts`
- Impact: World selection non-functional; no progression system between worlds; dead code clutter
- Fix approach: Add world selection menu after game over, implement level loading per world, dynamically set backgrounds/enemies per world

**Attack Animation Missing:**
- Issue: `Player.ts` line 204-206 has placeholder comment "We don't have an attack animation in the current assets"
- Files: `src/entities/Player.ts`
- Impact: No visual feedback during attack beyond hitbox visual; reduces combat feel and responsiveness
- Fix approach: Either load attack animation from assets or create attack visual effect using tweens/graphics

**Boss Configurations Not Used:**
- Issue: `GAME_CONFIG.BOSSES.EARTH_SNAKE` defined with 500 HP and 2-phase design but never instantiated
- Files: `src/config/GameConfig.ts`, `src/scenes/GameScene.ts`
- Impact: No boss encounters; level ends without climax; planned game progression is incomplete
- Fix approach: Create boss spawn logic in GameScene, implement phase transitions at 50% health threshold, place at level end

## Known Bugs

**Attack Hitbox Not Properly Destroyed:**
- Symptoms: Attack hitbox sometimes persists after attack ends or doesn't align with player position during movement
- Files: `src/entities/Player.ts` lines 145-157
- Trigger: Perform attack while moving rapidly, attack multiple times quickly
- Current behavior: Rectangle hitbox created in front of player is destroyed after 100ms, but if player moves during this window, hitbox position becomes stale
- Workaround: Stop moving before attacking for guaranteed hit detection
- Fix approach: Parent hitbox to player sprite or update hitbox position each frame during attack duration

**Dodge Invincibility Can Stack:**
- Symptoms: Player can chain dodges and remain invincible indefinitely if cooldown is circumvented
- Files: `src/entities/Player.ts` lines 176-198
- Trigger: Rapidly press C key; invincibility flag is set but not properly reset if dodge cooldown fires before dodge duration ends
- Current behavior: Dodge has both duration and cooldown, but invincibility could outlast both if state management goes wrong
- Workaround: Wait for dodge to fully complete before dodging again
- Fix approach: Explicitly reset invincibility flag in dodge duration callback, ensure it cannot be re-set while already active

**PlantEnemy Bullet Cleanup Has Hard-Coded World Bounds:**
- Symptoms: Bullets that travel off-screen in custom worlds may not despawn properly if world bounds differ from assumptions
- Files: `src/entities/Enemy.ts` lines 260-262
- Trigger: Play in a world with different dimensions than 2500x600
- Current behavior: Bullets check `if (b.x < 0 || b.x > 2000 || b.y < 0 || b.y > 600)` — hardcoded world edge at 2000 instead of world width
- Workaround: Keep world width at exactly 2500px
- Fix approach: Use `scene.physics.world.bounds` or pass world dimensions to PlantEnemy constructor instead of hardcoding 2000

**Defense Boost Calculation Confusing:**
- Symptoms: Defense boost multiplier of 0.75 means player takes 75% damage, not reduced damage (inverted logic)
- Files: `src/entities/Player.ts` line 229; `src/config/GameConfig.ts` line 75
- Trigger: Pick up defense boost item and take damage; math is `actualDamage = damage * 0.75` (should be `damage * 0.75` means taking 75% damage, which is correct but naming is confusing)
- Current behavior: Works as intended (0.75 multiplier = 25% reduction) but `defenseBoost` registry value is misleading
- Workaround: None needed, works correctly
- Fix approach: Rename to `defensionReduction` or apply as `damage * (1 - defenseBoost)` for clarity; add comments explaining boost multiplier semantics

**Item Boost Duration Never Resets Between Lives:**
- Symptoms: If player picks up attack/defense boost then dies, boost cooldown doesn't restart; new life inherits old boost state
- Files: `src/scenes/GameScene.ts` lines 338-350
- Trigger: Pick up attack boost, die before duration expires, respawn — boost may still be active on new life
- Current behavior: Boost uses `this.time.delayedCall()` which persists across player deaths unless explicitly cleared
- Workaround: Wait for boost to expire before intentionally dying
- Fix approach: Clear all delayed calls or reset boost values in `handlePlayerDeath()` before player respawns

## Security Considerations

**No Input Validation on Player Name:**
- Risk: HTML input element in `MenuScene.ts` accepts any text; no sanitization could allow XSS-like behavior if future versions store/display names unsafely
- Files: `src/scenes/MenuScene.ts` lines 97-125
- Current mitigation: Input is limited to 20 characters max, value is only displayed back to player in same session
- Recommendations: Add whitelist filter for allowed characters (alphanumeric + spaces), validate on input or before registry storage; sanitize if displaying in multiplayer/web contexts

**Registry Values Not Validated:**
- Risk: Registry can be manually manipulated via browser console; player could set unlimited health, lives, or attack boost
- Files: Multiple: `src/entities/Player.ts`, `src/scenes/GameScene.ts`, `src/scenes/UIScene.ts`
- Current mitigation: Only read from registry, but no guards against invalid values
- Recommendations: Add min/max clamping when reading from registry; validate boost multipliers are between 0.5-2.0; validate lives are 0-9

**Asset Paths Hardcoded:**
- Risk: If asset files are renamed or moved, game silently fails to load with no clear error message
- Files: `src/scenes/PreloadScene.ts` (all load calls, lines 54-208)
- Current mitigation: PreloadScene shows loading bar but doesn't display asset load errors
- Recommendations: Add load error handler to report which asset failed to load; consider logging asset load completion

## Performance Bottlenecks

**All Animations Created at Game Start:**
- Problem: `PreloadScene.createAnimations()` creates 20+ animations at startup in single method
- Files: `src/scenes/PreloadScene.ts` lines 216-363
- Impact: Initial load time increases with each new animation; all animations are loaded even if not used in current world
- Cause: Monolithic animation registry approach; no lazy loading or world-specific animation sets
- Improvement path: Split animations by world or enemy type; lazy-load animations when scenes need them; use animation manager cache more efficiently

**Enemy Patrol Distance Recalculated Every Update:**
- Problem: Each enemy checks patrol bounds every frame (`Enemy.ts` lines 73-76) with no optimization
- Files: `src/entities/Enemy.ts` lines 56-85
- Impact: Negligible for 8 enemies but scales poorly if 50+ enemies are spawned
- Cause: No spatial acceleration, simple distance checks every frame
- Improvement path: Use quadtrees or grids for collision detection; check patrol bounds less frequently or use boundaries as colliders

**Plant Enemy Bullets Iterated Every Frame:**
- Problem: `PlantEnemy.update()` loops through all bullets every frame to cull off-screen ones
- Files: `src/entities/Enemy.ts` lines 258-263
- Impact: Negligible with 1-2 plants but multiplied per PlantEnemy instance
- Cause: No physics world bounds integration for automatic despawn
- Improvement path: Use physics world bounds callback or culling plugin; move bullets to a group with auto-culling enabled

**Tweens Not Canceled on Scene Shutdown:**
- Problem: Active tweens from animations, item floats, and UI pops continue running even after scene stops
- Files: Multiple scenes create tweens without tracking or cleanup
- Impact: Memory leak if scene is restarted multiple times; tweens can fire on destroyed objects
- Cause: No tweens manager cleanup in scene shutdown handlers
- Improvement path: Store tweens array and call `tweens.killAll()` in shutdown event; use tweens manager's built-in lifecycle

**Item Floating Animation Infinite Loop:**
- Problem: Every item has infinite yoyo tween (`GameScene.ts` line 224: `repeat: -1`)
- Files: `src/scenes/GameScene.ts` lines 219-226
- Impact: Even collected items continue tweening until destroyed; wasted cycles
- Cause: No pause/stop before destroy
- Improvement path: Stop tween on item collection; use `tweens.remove()` before `item.destroy()`

## Fragile Areas

**GameScene Update Loop Casts Everything as Enemy/PlantEnemy:**
- Files: `src/scenes/GameScene.ts` lines 419-426
- Why fragile: Type casting `enemy as Enemy | PlantEnemy` assumes all children in `enemies` group are one of these types; if a different sprite is added to group, cast succeeds but methods will fail
- Safe modification: Create type guard function (`isEnemy()`, `isPlantEnemy()`) before casting; validate enemy has expected methods
- Test coverage: No unit tests for update loop; no type safety on group children

**Enemy Hurt State Can Get Stuck:**
- Files: `src/entities/Enemy.ts` lines 97-115
- Why fragile: If a delayed call timer is interrupted (e.g., scene pauses), `isHurt` flag may remain true permanently
- Safe modification: Always reset state in consistent places; avoid relying on delayed calls for state machines
- Test coverage: No tests for enemy state transitions across pause/unpause

**Collision Overlap Callbacks Don't Check Scene State:**
- Files: `src/scenes/GameScene.ts` lines 237-263
- Why fragile: Collision callbacks fire even if scene is paused or transitioning; player can take damage during level transitions
- Safe modification: Check `scene.isActive()` or `scene.isPaused()` before processing collisions
- Test coverage: No integration tests for scene transitions

**Player Invincibility Not Cleared on Scene Stop:**
- Files: `src/entities/Player.ts` lines 224-266
- Why fragile: If player dies while invincibility timer is pending, the timer still fires on next scene load, leaving player invincible
- Safe modification: Cancel all pending timers in Player shutdown handler
- Test coverage: No tests for player state across scene transitions

## Scaling Limits

**Current Level Capacity:**
- Current capacity: 8 enemies, 9 items, 4 sections, level width 2500px
- Limit: Performance degrades noticeably if spawning 50+ enemies (physics update load); rendering stays smooth to ~100 sprites
- Scaling path: Implement enemy object pooling; use spatial partitioning for collision detection; consider quadtree for large enemy counts; batch render with render texture

**World Bounds Hardcoded in Multiple Places:**
- Current: World is 2500x600, hardcoded in GameScene.ts line 21, PlantEnemy bullet culling line 260
- Limit: Changing world size requires updates in 3+ locations; easy to introduce inconsistency
- Scaling path: Store world dimensions in a constant; pass to all systems that need it

**Scene Transition Memory:**
- Current: No scene cleanup; registry persists, tweens may run, old scene graphics remain in memory
- Limit: After 5-10 world transitions, browser memory usage accumulates; may cause stuttering on low-end devices
- Scaling path: Implement scene shutdown cleanup (kill tweens, unsubscribe events, clear temporary graphics); use scene cache invalidation

## Dependencies at Risk

**Phaser 3.90.0 - Close to Deprecation Window:**
- Risk: Phaser 3 is no longer receiving major updates; security fixes only. Version 4 is in development
- Impact: Cannot use new Phaser 4 features; future browser APIs may break compatibility
- Migration plan: Plan upgrade to Phaser 4 in next major release; check compatibility before migrating (event system, physics API changes expected)

**TypeScript ~5.9.3 - Pinned Version:**
- Risk: Pinned with `~` allows patch/minor updates which may include breaking changes in edge cases
- Impact: Build could suddenly fail if TypeScript 5.10+ introduces stricter type checking
- Migration plan: Use `^` for more flexibility or pin exactly if current version is stable; test TypeScript upgrades in CI

**Vite 7.2.4 - Recent Major Version:**
- Risk: Vite 7 is relatively new; potential for undiscovered bugs or performance regressions
- Impact: Build times may change; asset bundling behavior may differ from Vite 6
- Migration plan: Monitor Vite releases; test builds after minor updates; keep current version until 7.x reaches wider adoption

## Missing Critical Features

**No Pause Menu:**
- Problem: ESC key is configured but pause functionality is not implemented
- Blocks: Player cannot pause to take a break, adjust settings, or check controls
- Priority: **Medium** — Improves QoL but game is playable without it

**No Level Progression System:**
- Problem: Only Earth world is playable; no world selection or level unlock system
- Blocks: Players cannot experience multiple worlds or progression arc
- Priority: **High** — Core game loop is incomplete; only 1 of 4 planned worlds available

**No Boss Encounters:**
- Problem: Earth Snake boss is configured but never spawned; level ends without climax
- Blocks: No final challenge or satisfying level completion
- Priority: **High** — Diminishes gameplay satisfaction and challenge curve

**No Settings/Audio Control:**
- Problem: No volume control, difficulty selector, or graphics settings
- Blocks: Players with audio sensitivities cannot mute; no difficulty scaling
- Priority: **Low** — Game is playable without; nice-to-have feature

**No Save/Load System:**
- Problem: No progression saves; must complete all 4 worlds in one session
- Blocks: Sessions longer than 10-15 minutes become risky; mobile players cannot suspend
- Priority: **Medium** — Essential for longer campaigns; localStorage could implement easily

## Test Coverage Gaps

**No Player Movement Tests:**
- What's not tested: Jump mechanics, double jump state, edge cases like jumping at world bounds
- Files: `src/entities/Player.ts`
- Risk: Refactoring player movement could break jump behavior silently; double jump state resets might fail
- Priority: **High** — Core mechanic should be regression-protected

**No Enemy AI Tests:**
- What's not tested: Patrol logic, direction changes, collision with platforms
- Files: `src/entities/Enemy.ts`
- Risk: Enemy behavior changes during refactoring; patrol distance edge cases (negative, zero) not validated
- Priority: **Medium** — Would catch patrol logic bugs quickly

**No Collision Handling Tests:**
- What's not tested: Enemy-player overlap callback, bullet-player overlap, item collection edge cases
- Files: `src/scenes/GameScene.ts` collision callbacks
- Risk: Collision detection breaks during physics system upgrades; callbacks may fail silently
- Priority: **High** — Collision is fundamental to gameplay

**No State Management Tests:**
- What's not tested: Registry state consistency, boost duration expiry, lives decrement on respawn
- Files: `src/scenes/GameScene.ts`, registry usage throughout
- Risk: State corrupts if boost timer and player death overlap; hard to reproduce and debug
- Priority: **High** — State bugs are invisible until they cause crash

**No Scene Transition Tests:**
- What's not tested: Memory cleanup on scene shutdown, tweens cleanup, event listener cleanup
- Files: All scenes
- Risk: Memory leaks accumulate on repeated world transitions; performance degrades
- Priority: **Medium** — Important for long play sessions

**No Pause/Resume Tests:**
- What's not tested: Physics pause behavior, animation pause, UI responsiveness while paused
- Files: Not yet implemented, but will be critical
- Risk: Pause system (when implemented) could freeze player or enemies permanently
- Priority: **Medium** — Feature not yet exists, but will need validation when added

---

*Concerns audit: 2026-03-01*
