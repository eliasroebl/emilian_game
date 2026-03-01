# Krone des Gingers - Codebase Guide

## Overview
A 2D pixel-art platformer built with **Phaser 3**, **TypeScript**, and **Vite**.
German-language UI. The player navigates a side-scrolling level, fights enemies, collects items, and tries to survive.

## Tech Stack
- **Phaser 3** (`^3.90.0`) — game engine with Arcade Physics
- **TypeScript** — strict mode, ES2022 target
- **Vite 7** — dev server and bundler
- Resolution: 800×600, pixel-art mode, auto-scaled to fit

## Project Structure
```
src/
├── main.ts                   # Phaser GameConfig + bootstrap
├── config/GameConfig.ts      # All tunable constants (player stats, enemy stats, items, controls)
├── entities/
│   ├── Player.ts             # Player class: movement, jump, double-jump, attack, dodge, health
│   └── Enemy.ts              # Enemy base class, EnemyFactory, PlantEnemy (ranged)
└── scenes/
    ├── BootScene.ts           # Minimal init → PreloadScene
    ├── PreloadScene.ts        # Loads all assets, creates all animations
    ├── MenuScene.ts           # Title screen with HTML name input
    ├── GameScene.ts           # Main gameplay: level layout, enemy/item spawning, collisions
    └── UIScene.ts             # HUD overlay: health bar, lives, score, world name
public/assets/                # Sprite sheets and backgrounds used by the game
```

## Scene Flow
BootScene → PreloadScene → MenuScene → GameScene + UIScene (launched in parallel)

## Commands
- `npm run dev` — start Vite dev server
- `npm run build` — TypeScript check + Vite production build
- `npm run preview` — preview production build

## Key Architecture Decisions
- **Registry** for shared state: playerName, currentWorld, lives, health, score, attackBoost, defenseBoost
- **Event-driven** communication between GameScene and UIScene (playerDamaged, playerHealed, livesUpdated, scoreUpdated, playerAttack, enemyKilled)
- **EnemyFactory** pattern for creating enemy variants (mushroom, chicken, rino, radish, plant)
- PlantEnemy is a separate class (not extending Enemy) because it has ranged attack behavior with a bullet group
- Level is procedurally laid out in code (no tilemap editor), world is 2500×600 px

## Game Controls
| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move |
| Space / Up / W | Jump (+ double jump in air) |
| X | Attack (melee hitbox) |
| C | Dodge (i-frames dash) |

## What's Implemented
- Full player movement with double jump, melee attack, dodge with i-frames
- 5 enemy types loaded (mushroom, chicken, rino, radish, plant), 3 used in level
- 4 item types: health (apple), attack boost (cherry), defense boost (kiwi), extra life (melon)
- 4-section level with increasing difficulty
- HUD with health bar, lives, score, world name

## What's Planned But Not Yet Built
- Multiple worlds (Stone, Water, Cloud) — config exists, only Earth is playable
- Boss fights (Earth Snake configured with 500 HP, 2-phase design)
- GameOverScene — referenced but not created
- Pause system — ESC key configured but no logic
- Chicken and Rino enemies — loaded but not placed in level
