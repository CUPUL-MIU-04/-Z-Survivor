import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Player, Zombie, Bullet, Particle, GameStats, AcidPool, AmmoDrop } from '../types';
import { Heart, Crosshair, Target, Zap } from 'lucide-react';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  onGameOver: (stats: GameStats) => void;
  onWaveChange: (wave: number, isHorde?: boolean) => void;
  lang: 'es' | 'en';
}

// Constants
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const PLAYER_SPEED = 5; // Slightly faster for larger map
const BULLET_SPEED = 12;
const ZOMBIE_SPAWN_RATE_BASE = 2000;
const MAX_AMMO = 30;
const RELOAD_TIME = 1500;

const translations = {
    es: {
        reloading: "RECARGANDO",
        ammo: "MUNICIÓN",
        low: "BAJA"
    },
    en: {
        reloading: "RELOADING",
        ammo: "AMMO",
        low: "LOW"
    }
};

const GameCanvas: React.FC<GameCanvasProps> = ({ gameState, setGameState, onGameOver, onWaveChange, lang }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const t = translations[lang];
  
  const [hudStats, setHudStats] = useState<GameStats>({
    score: 0,
    wave: 1,
    kills: 0,
    timeSurvived: 0,
    accuracy: 0,
    shotsFired: 0,
    shotsHit: 0
  });
  const [playerHp, setPlayerHp] = useState(100);
  const [ammoState, setAmmoState] = useState({ current: 30, total: 90, reloading: false });

  // Controls Refs
  const joystickRef = useRef({
    active: false,
    origin: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    identifier: null as number | null
  });
  const isFiringRef = useRef(false);
  
  // Camera Ref
  const cameraRef = useRef({ x: 0, y: 0 });

  // Mutable game state references
  const gameStateRef = useRef({
    player: {
      id: 'player',
      x: WORLD_WIDTH / 2,
      y: WORLD_HEIGHT / 2,
      dx: 0,
      dy: 0,
      radius: 15,
      color: '#3b82f6',
      hp: 100,
      maxHp: 100,
      damage: 25,
      speed: PLAYER_SPEED,
      angle: 0,
      ammo: MAX_AMMO,
      maxAmmo: MAX_AMMO,
      totalAmmo: 90,
      isReloading: false,
      reloadProgress: 0
    } as Player,
    bullets: [] as Bullet[],
    zombies: [] as Zombie[],
    particles: [] as Particle[],
    acidPools: [] as AcidPool[],
    ammoDrops: [] as AmmoDrop[],
    keys: { w: false, a: false, s: false, d: false },
    mouse: { x: 0, y: 0 },
    lastShot: 0,
    lastSpawn: 0,
    lastHorde: 0,
    stats: {
      score: 0,
      wave: 1,
      kills: 0,
      timeSurvived: 0,
      accuracy: 0,
      shotsFired: 0,
      shotsHit: 0
    } as GameStats,
    startTime: 0,
    isGameOver: false,
    bossSpawnedForWave: 0,
    lastDamageTick: 0,
    reloadStartTime: 0
  });

  // --- Input Handling ---

  const startReload = useCallback(() => {
      const state = gameStateRef.current;
      if (state.player.isReloading || state.player.ammo === state.player.maxAmmo || state.player.totalAmmo <= 0) return;
      
      state.player.isReloading = true;
      state.reloadStartTime = Date.now();
  }, []);

  // Keyboard & Mouse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (gameStateRef.current.keys.hasOwnProperty(key)) {
        gameStateRef.current.keys[key as keyof typeof gameStateRef.current.keys] = true;
      }
      // Escape to Pause
      if (e.key === 'Escape' && gameState === GameState.PLAYING) {
        setGameState(GameState.PAUSED);
      }
      // Reload
      if (key === 'r' && gameState === GameState.PLAYING) {
          startReload();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (gameStateRef.current.keys.hasOwnProperty(key)) {
        gameStateRef.current.keys[key as keyof typeof gameStateRef.current.keys] = false;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      gameStateRef.current.mouse.x = e.clientX;
      gameStateRef.current.mouse.y = e.clientY;
    };

    const handleMouseDown = () => {
      if (gameState === GameState.PLAYING) {
        shoot();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
    };
  }, [gameState, setGameState, startReload]);

  // Joystick Logic
  const handleJoystickStart = (e: React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling
    const touch = e.changedTouches[0];
    joystickRef.current.identifier = touch.identifier;
    joystickRef.current.active = true;
    joystickRef.current.origin = { x: touch.clientX, y: touch.clientY };
    joystickRef.current.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleJoystickMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!joystickRef.current.active) return;

    // Find the active touch
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === joystickRef.current.identifier) {
        joystickRef.current.current = { x: touch.clientX, y: touch.clientY };
        
        // Update visual knob
        const maxRadius = 40;
        let dx = touch.clientX - joystickRef.current.origin.x;
        let dy = touch.clientY - joystickRef.current.origin.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance > maxRadius) {
          const angle = Math.atan2(dy, dx);
          dx = Math.cos(angle) * maxRadius;
          dy = Math.sin(angle) * maxRadius;
        }

        if (joystickKnobRef.current) {
          joystickKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        }
        break;
      }
    }
  };

  const handleJoystickEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === joystickRef.current.identifier) {
        joystickRef.current.active = false;
        joystickRef.current.identifier = null;
        if (joystickKnobRef.current) {
          joystickKnobRef.current.style.transform = `translate(0px, 0px)`;
        }
        break;
      }
    }
  };

  // Fire Button Logic
  const handleFireStart = (e: React.SyntheticEvent) => {
    e.preventDefault();
    isFiringRef.current = true;
  };

  const handleFireEnd = (e: React.SyntheticEvent) => {
    e.preventDefault();
    isFiringRef.current = false;
  };

  // --- Game Logic Helpers ---

  const shoot = (targetOverride?: {x: number, y: number}) => {
    const state = gameStateRef.current;
    const now = Date.now();
    
    // Check reload
    if (state.player.isReloading) return;

    // Check Ammo
    if (state.player.ammo <= 0) {
        startReload();
        return;
    }

    if (now - state.lastShot < 150) return; // Fire rate limit

    state.lastShot = now;
    state.stats.shotsFired++;
    state.player.ammo--;

    let targetX, targetY;

    if (targetOverride) {
        // Target is already in World Space
        targetX = targetOverride.x;
        targetY = targetOverride.y;
    } else {
        // Mouse is in Screen Space, convert to World Space
        targetX = state.mouse.x + cameraRef.current.x;
        targetY = state.mouse.y + cameraRef.current.y;
    }

    const angle = Math.atan2(
      targetY - state.player.y,
      targetX - state.player.x
    );
    
    // Update player angle immediately for visual feedback
    state.player.angle = angle;

    const bullet: Bullet = {
      id: `bullet-${now}`,
      x: state.player.x + Math.cos(angle) * 20,
      y: state.player.y + Math.sin(angle) * 20,
      dx: Math.cos(angle) * BULLET_SPEED,
      dy: Math.sin(angle) * BULLET_SPEED,
      radius: 4,
      color: '#facc15',
      hp: 1,
      maxHp: 1,
      damage: state.player.damage,
      speed: BULLET_SPEED,
      createdAt: now
    };

    state.bullets.push(bullet);
  };

  const findNearestZombie = () => {
    const state = gameStateRef.current;
    let nearest: Zombie | null = null;
    let minDist = Infinity;
    // Only check zombies visible or close to visible could be an optimization, 
    // but for auto-aim we probably want the absolute closest even if off-screen slightly.
    
    state.zombies.forEach(z => {
        const dist = Math.hypot(state.player.x - z.x, state.player.y - z.y);
        if (dist < minDist && dist < 600) { // Max range for auto-aim
            minDist = dist;
            nearest = z;
        }
    });
    return nearest;
  };

  const spawnZombie = (overrideX?: number, overrideY?: number) => {
    const state = gameStateRef.current;
    const currentWave = state.stats.wave;
    const waveMultiplier = 1 + (currentWave * 0.1);
    
    // BOSS LOGIC (Every 10 waves)
    if (currentWave % 10 === 0 && state.bossSpawnedForWave !== currentWave) {
      state.bossSpawnedForWave = currentWave;
      // Boss spawns near player but far enough
      const angle = Math.random() * Math.PI * 2;
      const boss: Zombie = {
        id: `boss-${currentWave}`,
        x: state.player.x + Math.cos(angle) * 600,
        y: state.player.y + Math.sin(angle) * 600,
        dx: 0,
        dy: 0,
        radius: 60,
        color: '#0f0f0f',
        hp: 800 * waveMultiplier,
        maxHp: 800 * waveMultiplier,
        damage: 50,
        speed: 2.2, // Faster boss for bigger map
        type: 'boss'
      };
      // Clamp boss to world
      boss.x = Math.max(60, Math.min(WORLD_WIDTH - 60, boss.x));
      boss.y = Math.max(60, Math.min(WORLD_HEIGHT - 60, boss.y));
      
      state.zombies.push(boss);
      return;
    }

    // Spawn Location
    let x, y;
    if (overrideX !== undefined && overrideY !== undefined) {
        x = overrideX;
        y = overrideY;
    } else {
        // Spawn just outside camera view
        const cam = cameraRef.current;
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;
        const padding = 100;

        // Randomize side: 0=Top, 1=Right, 2=Bottom, 3=Left
        const side = Math.floor(Math.random() * 4);
        
        if (side === 0) { // Top
             x = cam.x + Math.random() * viewW;
             y = cam.y - padding;
        } else if (side === 1) { // Right
             x = cam.x + viewW + padding;
             y = cam.y + Math.random() * viewH;
        } else if (side === 2) { // Bottom
             x = cam.x + Math.random() * viewW;
             y = cam.y + viewH + padding;
        } else { // Left
             x = cam.x - padding;
             y = cam.y + Math.random() * viewH;
        }
    }

    // Clamp to World
    x = Math.max(20, Math.min(WORLD_WIDTH - 20, x));
    y = Math.max(20, Math.min(WORLD_HEIGHT - 20, y));

    const typeRoll = Math.random();
    let type: Zombie['type'] = 'walker';
    let speed = 2;
    let hp = 30;
    let radius = 12;
    let color = '#4ade80'; // Green

    // Spawn Logic (Progressive)
    if (currentWave >= 4) {
        const runnerChance = Math.min(0.1 + (currentWave * 0.05), 0.5);
        if (typeRoll < runnerChance) {
            type = 'runner';
            speed = 5;
            hp = 20;
            color = '#f87171'; // Red
        }
    }

    if (currentWave >= 7) {
        if (typeRoll > 0.85) {
            type = 'exploder';
            speed = 3.5;
            hp = 40;
            color = '#fb923c'; // Orange
            radius = 16;
        }
    }

    if (currentWave >= 12) {
        if (typeRoll > 0.92) {
            type = 'acid';
            speed = 3;
            hp = 60;
            color = '#bef264'; // Lime
            radius = 16;
        }
    }

    if (currentWave >= 10 && typeRoll > 0.95) {
      type = 'tank';
      speed = 1.5;
      hp = 150;
      radius = 22;
      color = '#a855f7'; // Purple
    }

    const zombie: Zombie = {
      id: `zombie-${Date.now()}-${Math.random()}`,
      x,
      y,
      dx: 0,
      dy: 0,
      radius,
      color,
      hp: hp * waveMultiplier,
      maxHp: hp * waveMultiplier,
      damage: 10 * waveMultiplier,
      speed: speed + (Math.random() * 0.5),
      type
    };

    state.zombies.push(zombie);
  };

  const triggerHorde = () => {
      const state = gameStateRef.current;
      onWaveChange(state.stats.wave, true); 
      
      const centerX = state.player.x;
      const centerY = state.player.y;
      const radius = 700; // Spawn circle radius (larger than before due to camera)

      const count = 15 + Math.floor(Math.random() * 10);
      for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 / count) * i;
          const spawnX = centerX + Math.cos(angle) * radius;
          const spawnY = centerY + Math.sin(angle) * radius;
          // Check bounds
          if (spawnX > 0 && spawnX < WORLD_WIDTH && spawnY > 0 && spawnY < WORLD_HEIGHT) {
              spawnZombie(spawnX, spawnY);
          }
      }
  };

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4;
      gameStateRef.current.particles.push({
        id: `p-${Date.now()}-${i}-${Math.random()}`,
        x,
        y,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: 1.0,
        color,
        size: Math.random() * 3 + 1
      });
    }
  };

  const createExplosion = (x: number, y: number) => {
      const state = gameStateRef.current;
      createParticles(x, y, '#fb923c', 30);
      createParticles(x, y, '#ef4444', 20);
      
      const distToPlayer = Math.hypot(state.player.x - x, state.player.y - y);
      if (distToPlayer < 120) {
          state.player.hp -= 25;
          setPlayerHp(Math.max(0, Math.floor(state.player.hp)));
      }

      state.zombies.forEach(z => {
          if (Math.hypot(z.x - x, z.y - y) < 120) {
              z.hp -= 100;
          }
      });
  };

  const spawnAmmoDrop = (x: number, y: number) => {
      gameStateRef.current.ammoDrops.push({
          id: `ammo-${Date.now()}-${Math.random()}`,
          x,
          y,
          radius: 12,
          amount: 15 + Math.floor(Math.random() * 20) 
      });
  };

  // --- Main Loop ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING && gameState !== GameState.PAUSED) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Initialize game if needed
    if (gameStateRef.current.startTime === 0) {
        gameStateRef.current.startTime = Date.now();
        gameStateRef.current.isGameOver = false;
        
        // Reset Game - Center of World
        gameStateRef.current.player.x = WORLD_WIDTH / 2;
        gameStateRef.current.player.y = WORLD_HEIGHT / 2;
        gameStateRef.current.player.hp = 100;
        gameStateRef.current.player.ammo = MAX_AMMO;
        gameStateRef.current.player.totalAmmo = 90;
        gameStateRef.current.player.isReloading = false;
        
        gameStateRef.current.zombies = [];
        gameStateRef.current.bullets = [];
        gameStateRef.current.particles = [];
        gameStateRef.current.acidPools = [];
        gameStateRef.current.ammoDrops = [];
        gameStateRef.current.bossSpawnedForWave = 0;
        gameStateRef.current.stats = {
            score: 0,
            wave: 1,
            kills: 0,
            timeSurvived: 0,
            accuracy: 0,
            shotsFired: 0,
            shotsHit: 0
        };
        setPlayerHp(100);
        setHudStats(gameStateRef.current.stats);
        setAmmoState({ current: MAX_AMMO, total: 90, reloading: false });
        
        // Init camera
        cameraRef.current.x = (WORLD_WIDTH / 2) - (canvas.width / 2);
        cameraRef.current.y = (WORLD_HEIGHT / 2) - (canvas.height / 2);
    }


    let animationFrameId: number;

    const render = () => {
      if (gameStateRef.current.isGameOver) return;

      const state = gameStateRef.current;
      const now = Date.now();

      if (gameState === GameState.PLAYING) {
        
        // Reloading Logic
        if (state.player.isReloading) {
            state.player.reloadProgress = (now - state.reloadStartTime) / RELOAD_TIME;
            if (state.player.reloadProgress >= 1) {
                state.player.isReloading = false;
                state.player.reloadProgress = 0;
                
                const needed = state.player.maxAmmo - state.player.ammo;
                const taken = Math.min(needed, state.player.totalAmmo);
                state.player.ammo += taken;
                state.player.totalAmmo -= taken;
            }
        }

        // 1. Player Movement
        let moveX = 0;
        let moveY = 0;

        if (state.keys.w) moveY -= 1;
        if (state.keys.s) moveY += 1;
        if (state.keys.a) moveX -= 1;
        if (state.keys.d) moveX += 1;

        if (joystickRef.current.active) {
            const dx = joystickRef.current.current.x - joystickRef.current.origin.x;
            const dy = joystickRef.current.current.y - joystickRef.current.origin.y;
            const maxDist = 40;
            const dist = Math.hypot(dx, dy);
            const intensity = Math.min(dist / maxDist, 1);
            const angle = Math.atan2(dy, dx);
            moveX += Math.cos(angle) * intensity;
            moveY += Math.sin(angle) * intensity;
        }

        const len = Math.hypot(moveX, moveY);
        if (len > 1) {
            moveX /= len;
            moveY /= len;
        }

        state.player.x += moveX * state.player.speed;
        state.player.y += moveY * state.player.speed;

        // Clamp to WORLD size
        state.player.x = Math.max(state.player.radius, Math.min(WORLD_WIDTH - state.player.radius, state.player.x));
        state.player.y = Math.max(state.player.radius, Math.min(WORLD_HEIGHT - state.player.radius, state.player.y));

        // 2. Camera Update (Follow Player)
        let camX = state.player.x - canvas.width / 2;
        let camY = state.player.y - canvas.height / 2;
        
        // Clamp Camera
        camX = Math.max(0, Math.min(camX, WORLD_WIDTH - canvas.width));
        camY = Math.max(0, Math.min(camY, WORLD_HEIGHT - canvas.height));
        
        cameraRef.current.x = camX;
        cameraRef.current.y = camY;

        // 3. Shooting
        if (isFiringRef.current) {
            const nearest = findNearestZombie();
            if (nearest) {
                shoot({ x: nearest.x, y: nearest.y });
            } else {
                const forwardX = state.player.x + Math.cos(state.player.angle) * 100;
                const forwardY = state.player.y + Math.sin(state.player.angle) * 100;
                shoot({ x: forwardX, y: forwardY });
            }
        }

        // 4. Spawning
        const spawnRate = Math.max(500, ZOMBIE_SPAWN_RATE_BASE - (state.stats.wave * 100));
        if (now - state.lastSpawn > spawnRate) {
            spawnZombie();
            state.lastSpawn = now;
        }

        if (now - state.lastHorde > 40000 && state.stats.wave > 3) { 
             if (Math.random() < 0.002) { 
                 state.lastHorde = now;
                 triggerHorde();
             }
        }

        if (state.stats.kills > state.stats.wave * 10 + (state.stats.wave * state.stats.wave)) {
            state.stats.wave++;
            onWaveChange(state.stats.wave, false);
        }

        // 5. Entities Update
        
        // Acid Pools
        for (let i = state.acidPools.length - 1; i >= 0; i--) {
            const pool = state.acidPools[i];
            if (now - pool.creationTime > pool.duration) {
                state.acidPools.splice(i, 1);
                continue;
            }
            if (now - state.lastDamageTick > 500) { 
                const dist = Math.hypot(state.player.x - pool.x, state.player.y - pool.y);
                if (dist < pool.radius) {
                    state.player.hp -= 5;
                    setPlayerHp(Math.floor(state.player.hp));
                    state.lastDamageTick = now;
                }
            }
        }

        // Ammo
        for (let i = state.ammoDrops.length - 1; i >= 0; i--) {
            const drop = state.ammoDrops[i];
            const dist = Math.hypot(state.player.x - drop.x, state.player.y - drop.y);
            if (dist < state.player.radius + drop.radius) {
                state.player.totalAmmo += drop.amount;
                state.ammoDrops.splice(i, 1);
            }
        }

        // Bullets
        for (let i = state.bullets.length - 1; i >= 0; i--) {
            const b = state.bullets[i];
            b.x += b.dx;
            b.y += b.dy;
            // Cull bullets outside world
            if (b.x < 0 || b.x > WORLD_WIDTH || b.y < 0 || b.y > WORLD_HEIGHT) {
              state.bullets.splice(i, 1);
            }
        }

        // Zombies
        for (let i = state.zombies.length - 1; i >= 0; i--) {
            const z = state.zombies[i];
            
            const angle = Math.atan2(state.player.y - z.y, state.player.x - z.x);
            z.x += Math.cos(angle) * z.speed;
            z.y += Math.sin(angle) * z.speed;

            // Bullet Collision
            for (let j = state.bullets.length - 1; j >= 0; j--) {
              const b = state.bullets[j];
              const dist = Math.hypot(b.x - z.x, b.y - z.y);
              
              if (dist < z.radius + b.radius) {
                  z.hp -= b.damage;
                  state.stats.shotsHit++;
                  createParticles(b.x, b.y, z.color, 3);
                  state.bullets.splice(j, 1);

                  if (z.hp <= 0) {
                    state.stats.kills++;
                    
                    if (z.type === 'exploder') {
                        createExplosion(z.x, z.y);
                    } else if (z.type === 'acid') {
                        state.acidPools.push({
                            id: `pool-${now}`,
                            x: z.x,
                            y: z.y,
                            radius: 40,
                            creationTime: now,
                            duration: 5000
                        });
                        createParticles(z.x, z.y, '#bef264', 15);
                    } else {
                        createParticles(z.x, z.y, z.type === 'boss' ? '#6b21a8' : '#ef4444', 10);
                    }

                    if (Math.random() < 0.3) spawnAmmoDrop(z.x, z.y);
                    
                    let scoreAdd = 10;
                    if (z.type === 'tank') scoreAdd = 50;
                    if (z.type === 'runner') scoreAdd = 20;
                    if (z.type === 'exploder') scoreAdd = 30;
                    if (z.type === 'acid') scoreAdd = 40;
                    if (z.type === 'boss') scoreAdd = 500;
                    
                    state.stats.score += scoreAdd;
                    state.zombies.splice(i, 1);
                  }
                  break;
              }
            }

            // Player Collision
            if (state.zombies.includes(z)) {
              const distToPlayer = Math.hypot(state.player.x - z.x, state.player.y - z.y);
              if (distToPlayer < state.player.radius + z.radius) {
                  state.player.hp -= 0.5;
                  setPlayerHp(Math.floor(state.player.hp));
                  
                  if (state.player.hp <= 0) {
                    state.isGameOver = true;
                    state.stats.timeSurvived = (Date.now() - state.startTime) / 1000;
                    onGameOver(state.stats);
                  }
              }
            }
        }

        for (let i = state.particles.length - 1; i >= 0; i--) {
            const p = state.particles[i];
            p.x += p.dx;
            p.y += p.dy;
            p.life -= 0.05;
            if (p.life <= 0) state.particles.splice(i, 1);
        }
        
        setHudStats({...state.stats});
        setAmmoState({
            current: state.player.ammo,
            total: state.player.totalAmmo,
            reloading: state.player.isReloading
        });
      }

      // --- Render ---
      
      if (gameState === GameState.PAUSED) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0,0, canvas.width, canvas.height);
      } else {
          ctx.fillStyle = '#0f172a'; // World BG color
          ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const camX = cameraRef.current.x;
      const camY = cameraRef.current.y;

      ctx.save();
      ctx.translate(-camX, -camY);

      // Render World Boundary
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 5;
      ctx.strokeRect(0,0, WORLD_WIDTH, WORLD_HEIGHT);

      // Optimization: Render Grid only in viewport
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.beginPath();
      
      const startGridX = Math.floor(camX / 50) * 50;
      const endGridX = startGridX + canvas.width + 50;
      const startGridY = Math.floor(camY / 50) * 50;
      const endGridY = startGridY + canvas.height + 50;

      for(let i=startGridX; i<=endGridX; i+=50) { 
          if (i > WORLD_WIDTH) break;
          ctx.moveTo(i, Math.max(0, startGridY)); 
          ctx.lineTo(i, Math.min(WORLD_HEIGHT, endGridY)); 
      }
      for(let i=startGridY; i<=endGridY; i+=50) { 
          if (i > WORLD_HEIGHT) break;
          ctx.moveTo(Math.max(0, startGridX), i); 
          ctx.lineTo(Math.min(WORLD_WIDTH, endGridX), i); 
      }
      ctx.stroke();

      // Acid Pools
      state.acidPools.forEach(p => {
          ctx.fillStyle = 'rgba(190, 242, 100, 0.4)';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#bef264';
          ctx.stroke();
      });

      // Ammo Drops
      state.ammoDrops.forEach(d => {
          ctx.save();
          ctx.translate(d.x, d.y);
          const offset = Math.sin(now / 200) * 3;
          ctx.translate(0, offset);
          ctx.fillStyle = '#047857';
          ctx.fillRect(-10, -10, 20, 20);
          ctx.strokeStyle = '#34d399';
          ctx.strokeRect(-10, -10, 20, 20);
          ctx.fillStyle = 'white';
          ctx.font = '12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('A', 0, 4);
          ctx.restore();
      });

      // Player
      ctx.save();
      ctx.translate(state.player.x, state.player.y);
      ctx.rotate(state.player.angle);
      ctx.fillStyle = state.player.color;
      ctx.shadowColor = state.player.color;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(0, 0, state.player.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, -4, 25, 8);
      ctx.restore();

      // Reload Bar
      if (state.player.isReloading) {
          ctx.save();
          ctx.translate(state.player.x, state.player.y - 30);
          ctx.fillStyle = 'black';
          ctx.fillRect(-20, 0, 40, 6);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-20, 0, 40 * state.player.reloadProgress, 6);
          ctx.restore();
      }

      // Zombies
      state.zombies.forEach(z => {
        // Optimization: Don't render far offscreen zombies
        if (z.x < camX - 100 || z.x > camX + canvas.width + 100 ||
            z.y < camY - 100 || z.y > camY + canvas.height + 100) return;

        ctx.save();
        ctx.translate(z.x, z.y);
        const zAngle = Math.atan2(state.player.y - z.y, state.player.x - z.x);
        ctx.rotate(zAngle);

        ctx.fillStyle = z.color;
        ctx.shadowColor = z.color;
        ctx.shadowBlur = 5;
        
        if (z.type === 'walker') {
          ctx.fillRect(-z.radius, -z.radius, z.radius * 2, z.radius * 2);
        } else if (z.type === 'runner') {
          ctx.beginPath();
          ctx.moveTo(z.radius, 0);
          ctx.lineTo(-z.radius, z.radius);
          ctx.lineTo(-z.radius, -z.radius);
          ctx.fill();
        } else if (z.type === 'tank') {
           ctx.beginPath();
           ctx.arc(0, 0, z.radius, 0, Math.PI*2);
           ctx.fill();
           ctx.strokeStyle = '#000';
           ctx.lineWidth = 2;
           ctx.stroke();
        } else if (z.type === 'exploder') {
            ctx.beginPath();
            ctx.arc(0, 0, z.radius, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(Math.sin(now / 200)) * 0.5})`;
            ctx.beginPath();
            ctx.arc(0, 0, z.radius * 0.6, 0, Math.PI*2);
            ctx.fill();
        } else if (z.type === 'acid') {
            ctx.beginPath();
            ctx.moveTo(z.radius, 0);
            ctx.lineTo(-z.radius/2, z.radius);
            ctx.lineTo(-z.radius/2, -z.radius);
            ctx.fill();
            ctx.strokeStyle = '#bef264';
            ctx.stroke();
        } else if (z.type === 'boss') {
           ctx.shadowColor = '#dc2626';
           ctx.shadowBlur = 20;
           ctx.beginPath();
           ctx.arc(0, 0, z.radius, 0, Math.PI*2);
           ctx.fill();
           ctx.strokeStyle = '#dc2626';
           ctx.lineWidth = 4;
           ctx.stroke();
           ctx.fillStyle = 'black';
           ctx.beginPath();
           ctx.arc(-15, -15, 8, 0, Math.PI*2);
           ctx.arc(15, -15, 8, 0, Math.PI*2);
           ctx.fill();
        }
        
        const hpPct = z.hp / z.maxHp;
        ctx.fillStyle = '#ef4444';
        const barWidth = z.type === 'boss' ? 60 : 20;
        const barOffset = z.type === 'boss' ? 20 : 10;
        ctx.fillRect(-barWidth/2, -z.radius - barOffset, barWidth, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-barWidth/2, -z.radius - barOffset, barWidth * hpPct, 4);

        ctx.restore();
      });

      // Bullets
      ctx.fillStyle = '#facc15';
      ctx.shadowColor = '#facc15';
      ctx.shadowBlur = 5;
      state.bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Particles
      state.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });
      
      ctx.restore(); // End Camera Transform

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(animationFrameId);
    };
  }, [gameState, onGameOver, onWaveChange]);

  // Reset start time when going back to Menu
  useEffect(() => {
      if (gameState === GameState.MENU) {
          gameStateRef.current.startTime = 0;
      }
  }, [gameState]);

  if (gameState !== GameState.PLAYING && gameState !== GameState.PAUSED) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="block fixed top-0 left-0 cursor-crosshair z-0 touch-none"
      />
      
      {/* HUD - Stats */}
      <div className="fixed top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
         {/* Health */}
         <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-4 rounded-lg shadow-lg min-w-[200px]">
            <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-bold">HEALTH</span>
                <div className="flex items-center gap-1">
                    <Heart className={`w-4 h-4 ${playerHp < 30 ? 'text-red-500 animate-pulse' : 'text-green-500'}`} fill="currentColor" />
                    <span className={`font-mono text-lg ${playerHp < 30 ? 'text-red-500' : 'text-white'}`}>{playerHp}%</span>
                </div>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-300 ${playerHp < 30 ? 'bg-red-600' : 'bg-green-500'}`} 
                    style={{ width: `${playerHp}%` }}
                />
            </div>
         </div>

         {/* Ammo Display */}
         <div className={`bg-slate-900/80 backdrop-blur border p-4 rounded-lg shadow-lg min-w-[200px] transition-colors ${ammoState.current === 0 ? 'border-red-500 bg-red-900/20' : 'border-slate-700'}`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm font-bold flex items-center gap-1">
                    <Zap className="w-4 h-4 text-yellow-500" /> {t.ammo}
                </span>
                <div className="text-right">
                    {ammoState.reloading ? (
                        <span className="text-yellow-500 font-bold animate-pulse text-sm">{t.reloading}</span>
                    ) : (
                        <span className={`font-mono text-2xl font-bold ${ammoState.current === 0 ? 'text-red-500' : 'text-white'}`}>
                            {ammoState.current} <span className="text-slate-500 text-lg">/ {ammoState.total}</span>
                        </span>
                    )}
                </div>
            </div>
            {ammoState.current < 10 && !ammoState.reloading && (
                <div className="text-red-500 text-xs font-bold text-center animate-bounce">
                   {ammoState.current === 0 ? t.reloading : t.low}
                </div>
            )}
         </div>

         {/* Score */}
         <div className="bg-slate-900/80 backdrop-blur border border-slate-700 p-3 rounded-lg shadow-lg flex items-center justify-between">
             <div className="flex items-center gap-2">
                 <Crosshair className="w-4 h-4 text-yellow-400" />
                 <span className="text-slate-400 text-xs font-bold">{lang === 'es' ? 'PUNTOS' : 'SCORE'}</span>
             </div>
             <span className="font-mono text-xl text-yellow-400">{hudStats.score.toLocaleString()}</span>
         </div>
      </div>

      {/* HUD - Wave */}
      <div className="fixed top-4 right-4 z-10 pointer-events-none">
        <div className={`bg-slate-900/80 backdrop-blur border p-4 rounded-lg shadow-lg transition-colors ${hudStats.wave % 10 === 0 ? 'border-red-500 shadow-red-900/50' : 'border-red-900/50'}`}>
            <div className="flex flex-col items-center">
                <span className={`font-creep text-3xl tracking-widest ${hudStats.wave % 10 === 0 ? 'text-red-500 animate-pulse' : 'text-red-500'}`}>
                    {hudStats.wave % 10 === 0 ? (lang === 'es' ? 'JEFE' : 'BOSS') : (lang === 'es' ? 'RONDA' : 'WAVE')}
                </span>
                <span className="font-creep text-white text-5xl drop-shadow-lg">{hudStats.wave}</span>
            </div>
        </div>
      </div>

      {/* Mobile Controls Overlay */}
      <div className="fixed inset-0 z-20 pointer-events-none">
          {/* Joystick Area - Left */}
          <div 
            className="absolute bottom-8 left-8 w-48 h-48 rounded-full bg-slate-900/10 border-2 border-slate-500/20 pointer-events-auto touch-none flex items-center justify-center"
            onTouchStart={handleJoystickStart}
            onTouchMove={handleJoystickMove}
            onTouchEnd={handleJoystickEnd}
          >
              {/* Knob */}
              <div 
                ref={joystickKnobRef}
                className="w-16 h-16 bg-slate-400/30 rounded-full shadow-lg backdrop-blur-[2px]"
              />
          </div>

          {/* Fire Button - Right */}
          <div 
            className="absolute bottom-12 right-12 w-24 h-24 pointer-events-auto touch-none"
            onTouchStart={handleFireStart}
            onTouchEnd={handleFireEnd}
            onMouseDown={handleFireStart}
            onMouseUp={handleFireEnd}
            onMouseLeave={handleFireEnd}
          >
              <div className={`w-full h-full rounded-full border-4 flex items-center justify-center transition-all duration-100 ${isFiringRef.current ? 'bg-red-600/50 border-red-400 scale-95' : 'bg-red-900/30 border-red-600/40'}`}>
                 {ammoState.current === 0 && !ammoState.reloading ? (
                     <span className="text-white font-bold text-xs">EMPTY</span>
                 ) : (
                     <Target className="w-10 h-10 text-white/80" />
                 )}
              </div>
          </div>
          
          {/* Reload Button (Mobile) - Top of Fire Button */}
          <div className="absolute bottom-40 right-16 pointer-events-auto">
             <button 
                onTouchStart={(e) => { e.preventDefault(); startReload(); }}
                onClick={startReload}
                className="bg-slate-800/80 border border-slate-600 text-white p-3 rounded-full shadow-lg active:scale-95"
             >
                <Zap className={`w-6 h-6 ${ammoState.reloading ? 'animate-spin' : ''}`} />
             </button>
          </div>
      </div>
    </>
  );
};

export default GameCanvas;