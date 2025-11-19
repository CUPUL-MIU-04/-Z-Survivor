export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER'
}

export interface Point {
  x: number;
  y: number;
}

export interface Velocity {
  dx: number;
  dy: number;
}

export interface Entity extends Point, Velocity {
  id: string;
  radius: number;
  color: string;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
}

export interface Player extends Entity {
  angle: number;
  ammo: number;
  maxAmmo: number; // Clip size
  totalAmmo: number; // Reserve ammo
  isReloading: boolean;
  reloadProgress: number;
}

export interface Zombie extends Entity {
  type: 'walker' | 'runner' | 'tank' | 'boss' | 'exploder' | 'acid';
}

export interface AcidPool extends Point {
  id: string;
  radius: number;
  creationTime: number;
  duration: number; // ms
}

export interface AmmoDrop extends Point {
  id: string;
  amount: number;
  radius: number;
}

export interface Bullet extends Entity {
  createdAt: number;
}

export interface Particle extends Point, Velocity {
  id: string;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface GameStats {
  score: number;
  wave: number;
  kills: number;
  timeSurvived: number;
  accuracy: number;
  shotsFired: number;
  shotsHit: number;
}