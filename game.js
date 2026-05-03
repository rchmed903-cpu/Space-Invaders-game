const canvas = document.getElementById('si-canvas');
const ctx = canvas.getContext('2d');
const W = 560, H = 420;
const COLS = 11, ROWS = 5;
const INV_W = 28, INV_H = 20, INV_GAP_X = 14, INV_GAP_Y = 16;
const START_X = 40, START_Y = 50;

let state = 'idle', score = 0, hi = 0, lives = 3, level = 1;
let player, bullets, invBullets, invaders, barriers, particles;
let invDir = 1, invDropPending = false, invMoveTimer = 0, invMoveInterval = 600;
let raf = null, lastTime = 0;
let keys = {};
let mobileLeft = false, mobileRight = false, mobileFire = false, lastMobileFire = false;

function drawInvader(x, y, type) {
  ctx.fillStyle = type === 0 ? '#0ff' : type === 1 ? '#0f0' : '#ff0';
  if (type === 0) {
    ctx.fillRect(x+8,y,4,2); ctx.fillRect(x+4,y+2,12,2);
    ctx.fillRect(x+2,y+4,16,2); ctx.fillRect(x,y+6,4,2);
    ctx.fillRect(x+6,y+6,8,2); ctx.fillRect(x+16,y+6,4,2);
    ctx.fillRect(x+2,y+8,4,2); ctx.fillRect(x+8,y+8,4,2);
    ctx.fillRect(x+14,y+8,4,2); ctx.fillRect(x,y+10,4,4);
    ctx.fillRect(x+16,y+10,4,4);
  } else if (type === 1) {
    ctx.fillRect(x+4,y,2,2); ctx.fillRect(x+14,y,2,2);
    ctx.fillRect(x+2,y+2,16,2); ctx.fillRect(x,y+4,20,2);
    ctx.fillRect(x+2,y+6,4,2); ctx.fillRect(x+10,y+6,2,2);
    ctx.fillRect(x+14,y+6,4,2); ctx.fillRect(x,y+8,6,2);
    ctx.fillRect(x+8,y+8,4,2); ctx.fillRect(x+14,y+8,6,2);
    ctx.fillRect(x,y+10,4,2); ctx.fillRect(x+16,y+10,4,2);
  } else {
    ctx.fillRect(x+6,y,8,2); ctx.fillRect(x+4,y+2,12,2);
    ctx.fillRect(x+2,y+4,16,2); ctx.fillRect(x+2,y+6,6,2);
    ctx.fillRect(x+12,y+6,6,2); ctx.fillRect(x,y+8,20,2);
    ctx.fillRect(x+4,y+10,4,2); ctx.fillRect(x+12,y+10,4,2);
    ctx.fillRect(x+2,y+12,4,2); ctx.fillRect(x+14,y+12,4,2);
  }
}

function initGame() {
  player = { x: W/2-14, y: H-36, w: 28, h: 14, speed: 4, shotCooldown: 0 };
  bullets = []; invBullets = []; particles = [];
  invaders = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      invaders.push({
        x: START_X + c * (INV_W + INV_GAP_X),
        y: START_Y + r * (INV_H + INV_GAP_Y),
        type: r < 1 ? 2 : r < 3 ? 1 : 0,
        alive: true
      });
    }
  }
  barriers = [];
  const bxPositions = [90, 190, 290, 390, 470];
  bxPositions.forEach(bxp => {
    for (let by = 0; by < 5; by++) {
      for (let bxx = 0; bxx < 10; bxx++) {
        if ((by === 0 && (bxx < 2 || bxx > 7)) || (by === 4 && (bxx > 3 && bxx < 6))) continue;
        barriers.push({ x: bxp + bxx * 4, y: H - 80 + by * 4, alive: true });
      }
    }
  });
  invDir = 1; invDropPending = false;
  invMoveInterval = Math.max(80, 600 - level * 60);
  invMoveTimer = 0;
}

function spawnParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 30, color });
  }
}

function aliveInvaders() { return invaders.filter(i => i.alive); }

function update(dt) {
  if (state !== 'playing') return;

  const mv = (keys['ArrowLeft'] || keys['a'] || mobileLeft) ? -1
           : (keys['ArrowRight'] || keys['d'] || mobileRight) ? 1 : 0;
  player.x = Math.max(0, Math.min(W - player.w, player.x + mv * player.speed));

  if (player.shotCooldown > 0) player.shotCooldown -= dt;
  const firePressed = keys[' '] || keys['ArrowUp'] || mobileFire;
  if (firePressed && player.shotCooldown <= 0) {
    bullets.push({ x: player.x + player.w/2 - 1, y: player.y - 4, w: 2, h: 8, vy: -8 });
    player.shotCooldown = 300;
  }
  if (mobileFire && !lastMobileFire) player.shotCooldown = 0;
  lastMobileFire = mobileFire;

  bullets = bullets.filter(b => { b.y += b.vy; return b.y > -10; });
  invBullets = invBullets.filter(b => { b.y += b.vy; return b.y < H + 10; });

  invMoveTimer += dt;
  if (invMoveTimer >= invMoveInterval) {
    invMoveTimer = 0;
    const alive = aliveInvaders();
    if (!alive.length) return;
    const minX = Math.min(...alive.map(i => i.x));
    const maxX = Math.max(...alive.map(i => i.x + INV_W));
    if (invDropPending) {
      invaders.forEach(i => { if (i.alive) i.y += 16; });
      invDropPending = false;
    } else {
      invaders.forEach(i => { if (i.alive) i.x += invDir * 16; });
      if (maxX + invDir * 16 > W - 4 || minX + invDir * 16 < 4) {
        invDropPending = true; invDir *= -1;
      }
    }
    invMoveInterval = Math.max(60, (600 - level * 60) * (alive.length / (COLS * ROWS)));
    if (alive.length && Math.random() < 0.3) {
      const shooter = alive[Math.floor(Math.random() * alive.length)];
      invBullets.push({ x: shooter.x + INV_W/2 - 1, y: shooter.y + INV_H, w: 2, h: 8, vy: 4 + level * 0.5, color: '#f0f' });
    }
  }

  bullets.forEach(b => {
    invaders.forEach(inv => {
      if (!inv.alive) return;
      if (b.x < inv.x+INV_W && b.x+b.w > inv.x && b.y < inv.y+INV_H && b.y+b.h > inv.y) {
        inv.alive = false; b.y = -999;
        const pts = inv.type === 2 ? 30 : inv.type === 1 ? 20 : 10;
        score += pts; hi = Math.max(hi, score);
        document.getElementById('si-score').textContent = score;
        document.getElementById('si-hi').textContent = hi;
        spawnParticles(inv.x + INV_W/2, inv.y + INV_H/2, inv.type === 2 ? '#ff0' : inv.type === 1 ? '#0f0' : '#0ff');
      }
    });
  });

  [...bullets, ...invBullets].forEach(b => {
    barriers.forEach(br => {
      if (!br.alive) return;
      if (b.x < br.x+4 && b.x+b.w > br.x && b.y < br.y+4 && b.y+b.h > br.y) {
        br.alive = false; b.y = -999;
      }
    });
  });

  invBullets.forEach(b => {
    if (b.x < player.x+player.w && b.x+b.w > player.x && b.y < player.y+player.h && b.y+b.h > player.y) {
      b.y = H + 99;
      spawnParticles(player.x + 14, player.y + 7, '#0f0');
      lives--;
      document.getElementById('si-lives').textContent = ('♥ ').repeat(Math.max(0, lives)).trim() || '';
      if (lives <= 0) { endGame(false); return; }
      player.x = W/2 - 14;
    }
  });

  if (aliveInvaders().some(i => i.y + INV_H >= player.y)) { endGame(false); return; }

  if (!aliveInvaders().length) {
    level++;
    document.getElementById('si-level').textContent = level;
    document.getElementById('si-msg').textContent = 'WAVE ' + level + ' — INCOMING!';
    setTimeout(() => {
      if (state === 'playing') { initGame(); document.getElementById('si-msg').textContent = ''; }
    }, 1200);
  }

  particles = particles.filter(p => { p.x += p.vx; p.y += p.vy; p.life--; return p.life > 0; });
}

function drawPlayer() {
  ctx.fillStyle = '#0f0';
  ctx.fillRect(player.x+12, player.y, 4, 2);
  ctx.fillRect(player.x+8, player.y+2, 12, 2);
  ctx.fillRect(player.x, player.y+4, 28, 2);
  ctx.fillRect(player.x, player.y+6, 28, 6);
  ctx.fillRect(player.x+4, player.y+12, 4, 2);
  ctx.fillRect(player.x+20, player.y+12, 4, 2);
}

function draw() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#111';
  for (let i = 0; i < 80; i++) {
    const sx = (i*137 + i*i*13) % W, sy = (i*97 + i*i*7) % H;
    ctx.fillRect(sx, sy, 1, 1);
  }

  if (state === 'idle' || state === 'over') {
    ctx.fillStyle = '#0f0'; ctx.font = 'bold 28px "Share Tech Mono"'; ctx.textAlign = 'center';
    ctx.fillText(state === 'idle' ? 'SPACE INVADERS' : 'GAME OVER', W/2, H/2 - 30);
    ctx.font = '14px "Share Tech Mono"'; ctx.fillStyle = '#080';
    ctx.fillText('SCORE: ' + score, W/2, H/2 + 10);
    ctx.fillText('HI: ' + hi, W/2, H/2 + 34);
    ctx.textAlign = 'left'; return;
  }

  ctx.fillStyle = '#0a4';
  barriers.forEach(b => { if (b.alive) ctx.fillRect(b.x, b.y, 4, 4); });

  invaders.forEach(inv => { if (inv.alive) drawInvader(inv.x, inv.y, inv.type); });

  drawPlayer();

  ctx.fillStyle = '#ff0';
  bullets.forEach(b => ctx.fillRect(b.x, b.y, b.w, b.h));
  invBullets.forEach(b => { ctx.fillStyle = b.color || '#f0f'; ctx.fillRect(b.x, b.y, b.w, b.h); });

  particles.forEach(p => {
    ctx.globalAlpha = p.life / 30; ctx.fillStyle = p.color;
    ctx.fillRect(p.x-1, p.y-1, 3, 3);
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#0f0'; ctx.fillRect(0, H-4, W, 2);
}

function loop(ts) {
  const dt = ts - lastTime; lastTime = ts;
  update(dt); draw();
  raf = requestAnimationFrame(loop);
}

function startGame() {
  score = 0; lives = 3; level = 1;
  document.getElementById('si-score').textContent = '0';
  document.getElementById('si-lives').textContent = '♥ ♥ ♥';
  document.getElementById('si-level').textContent = '1';
  document.getElementById('si-msg').textContent = '';
  document.getElementById('si-start-btn').textContent = 'RESTART';
  initGame(); state = 'playing';
  if (raf) cancelAnimationFrame(raf);
  lastTime = performance.now();
  raf = requestAnimationFrame(loop);
}

function endGame(win) {
  state = 'over';
  document.getElementById('si-msg').textContent = win ? 'YOU WIN!' : 'GAME OVER';
  document.getElementById('si-start-btn').textContent = 'PLAY AGAIN';
}

document.getElementById('si-start-btn').addEventListener('click', startGame);
document.addEventListener('keydown', e => { keys[e.key] = true; if (e.key === ' ') e.preventDefault(); });
document.addEventListener('keyup', e => { keys[e.key] = false; });

const lb = document.getElementById('si-left-btn');
const rb2 = document.getElementById('si-right-btn');
const fb = document.getElementById('si-fire-btn');
lb.addEventListener('pointerdown', () => mobileLeft = true);
lb.addEventListener('pointerup', () => mobileLeft = false);
lb.addEventListener('pointerleave', () => mobileLeft = false);
rb2.addEventListener('pointerdown', () => mobileRight = true);
rb2.addEventListener('pointerup', () => mobileRight = false);
rb2.addEventListener('pointerleave', () => mobileRight = false);
fb.addEventListener('pointerdown', () => mobileFire = true);
fb.addEventListener('pointerup', () => mobileFire = false);
fb.addEventListener('pointerleave', () => mobileFire = false);

draw();
