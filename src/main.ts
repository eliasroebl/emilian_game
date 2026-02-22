import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { VirtualControlsScene } from './scenes/VirtualControlsScene';
import { TestScene } from './scenes/TestScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  pixelArt: true,
  input: {
    activePointers: 4,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 650 },
      debug: false // Set to true for development
    }
  },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, VirtualControlsScene, TestScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);
