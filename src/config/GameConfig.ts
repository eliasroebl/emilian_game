// Game Configuration
export const GAME_CONFIG = {
  // Player settings
  PLAYER: {
    SPEED: 220,
    JUMP_VELOCITY: -520,
    DOUBLE_JUMP_VELOCITY: -440,
    DODGE_VELOCITY: 300,
    DODGE_DURATION: 300, // ms
    DODGE_COOLDOWN: 800, // ms
    MAX_HEALTH: 100,
    ATTACK_DAMAGE: 25,
    ATTACK_RANGE: 40,
    ATTACK_COOLDOWN: 400, // ms
    INVINCIBILITY_DURATION: 1000, // ms after getting hit
  },

  // World settings
  WORLDS: {
    EARTH: {
      name: 'Erdwelt',
      lives: 3,
      backgroundColor: 0x87CEEB,
    },
    STONE: {
      name: 'Steinwelt',
      lives: 3,
      backgroundColor: 0x696969,
    },
    WATER: {
      name: 'Wasserwelt',
      lives: 3,
      backgroundColor: 0x1E90FF,
    },
    CLOUD: {
      name: 'Wolkenwelt',
      lives: 3,
      backgroundColor: 0xE6E6FA,
    },
  },

  // Enemy base stats (will be scaled per enemy type)
  ENEMIES: {
    MOLE: {
      health: 50,
      damage: 15,
      speed: 80,
      points: 100,
    },
    MUSHROOM: {
      health: 30,
      damage: 10,
      speed: 60,
      points: 50,
    },
  },

  // Boss settings
  BOSSES: {
    EARTH_SNAKE: {
      health: 500,
      damage: 30,
      phase2HealthThreshold: 0.5, // At 50% health, enter phase 2
      points: 1000,
    },
  },

  // Item effects
  ITEMS: {
    ATTACK_BOOST: {
      multiplier: 1.25,
      duration: 10000, // ms, 0 = permanent
    },
    DEFENSE_BOOST: {
      multiplier: 0.75, // damage reduction
      duration: 10000,
    },
    EXTRA_LIFE: {
      lives: 1,
    },
    HEALTH_POTION: {
      healAmount: 50,
    },
  },

  // Physics
  PHYSICS: {
    TILE_SIZE: 16,
    GRAVITY: 800,
  },
};

// Keyboard controls
export const CONTROLS = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  UP: 'UP',
  DOWN: 'DOWN',
  JUMP: 'SPACE',
  ATTACK: 'X',
  DODGE: 'C',
  PAUSE: 'ESC',
};
