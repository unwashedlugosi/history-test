// Space Invaders easter egg — ported from grammar-quiz
// Triggered at 20-streak in Prove It mode

export function launchSpaceInvaders(onClose) {
  const overlay = document.createElement('div');
  overlay.className = 'si-overlay';

  // SPLASH PHASE
  overlay.innerHTML = `
    <div class="si-splash">
      <div class="si-splash-icon">👾</div>
      <h1 class="si-splash-title">20-IN-A-ROW!</h1>
      <p class="si-splash-sub">SPACE INVADERS</p>
      <div class="si-splash-bar-track"><div class="si-splash-bar-fill"></div></div>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => startGame(overlay, onClose), 2500);
}

function startGame(overlay, onClose) {
  let score = 0, finalStats = null, timeLeft = 60, lives = 3, waveNum = 1;

  overlay.innerHTML = `
    <div class="si-game-wrap">
      <div class="si-timer-bar">
        <span>👾 SPACE INVADERS</span>
        <span class="si-timer-text" style="font-family:monospace">${timeLeft}s</span>
      </div>
      <div style="position:relative">
        <canvas class="si-canvas" width="360" height="520"></canvas>
        <canvas class="si-scanlines-canvas" width="360" height="520"></canvas>
      </div>
    </div>
  `;

  const canvas = overlay.querySelector('.si-canvas');
  const scanCanvas = overlay.querySelector('.si-scanlines-canvas');
  const timerEl = overlay.querySelector('.si-timer-text');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height, PX = 3;

  // CRT scanlines
  const sctx = scanCanvas.getContext('2d');
  sctx.clearRect(0, 0, scanCanvas.width, scanCanvas.height);
  for (let y = 0; y < scanCanvas.height; y += 3) { sctx.fillStyle = 'rgba(0,0,0,0.15)'; sctx.fillRect(0, y, scanCanvas.width, 1); }
  for (let y = 0; y < scanCanvas.height; y += 6) { sctx.fillStyle = `rgba(${y % 2 === 0 ? '40,0,0' : '0,0,40'},0.03)`; sctx.fillRect(0, y, scanCanvas.width, 3); }
  const vg = sctx.createRadialGradient(scanCanvas.width/2, scanCanvas.height/2, scanCanvas.height*0.32, scanCanvas.width/2, scanCanvas.height/2, scanCanvas.height*0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  sctx.fillStyle = vg; sctx.fillRect(0, 0, scanCanvas.width, scanCanvas.height);

  // AUDIO
  let audioCtx = null, ufoNodes = null;
  function initAudio() { if (audioCtx) return audioCtx; try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {} return audioCtx; }
  function sfxShoot() { const ac = initAudio(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = 'square'; o.frequency.setValueAtTime(1400, ac.currentTime); o.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.07); g.gain.setValueAtTime(0.10, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.07); o.start(ac.currentTime); o.stop(ac.currentTime + 0.07); }
  function sfxExplode() { const ac = initAudio(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = 'square'; o.frequency.setValueAtTime(700, ac.currentTime); o.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.18); g.gain.setValueAtTime(0.13, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.18); o.start(ac.currentTime); o.stop(ac.currentTime + 0.18); }
  const MARCH_FREQS = [73.4, 69.3, 65.4, 61.7]; let marchIdx = 0;
  function sfxMarch() { const ac = initAudio(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = 'square'; o.frequency.setValueAtTime(MARCH_FREQS[marchIdx % 4], ac.currentTime); marchIdx++; g.gain.setValueAtTime(0.15, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08); o.start(ac.currentTime); o.stop(ac.currentTime + 0.08); }
  function sfxUFOStart() { const ac = initAudio(); if (!ac || ufoNodes) return; const o = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(); l.type = 'sine'; l.frequency.value = 6; lg.gain.value = 80; l.connect(lg); lg.connect(o.frequency); o.type = 'triangle'; o.frequency.value = 400; o.connect(g); g.gain.value = 0.06; g.connect(ac.destination); l.start(); o.start(); ufoNodes = { osc: o, lfo: l, gain: g }; }
  function sfxUFOStop() { if (!ufoNodes) return; try { ufoNodes.osc.stop(); ufoNodes.lfo.stop(); } catch(e) {} ufoNodes = null; }
  function sfxPlayerDeath() { const ac = initAudio(); if (!ac) return; for (let i = 0; i < 6; i++) { const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = 'sawtooth'; const t = ac.currentTime + i * 0.1; o.frequency.setValueAtTime(440 - i * 55, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.09); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09); o.start(t); o.stop(t + 0.1); } }
  function sfxShieldHit() { const ac = initAudio(); if (!ac) return; const buf = ac.createBuffer(1, ac.sampleRate * 0.04, ac.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3; const s = ac.createBufferSource(); s.buffer = buf; const g = ac.createGain(); g.gain.setValueAtTime(0.08, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.04); s.connect(g); g.connect(ac.destination); s.start(); }
  function sfxWaveClear() { const ac = initAudio(); if (!ac) return; [523, 659, 784, 1047].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = 'square'; const t = ac.currentTime + i * 0.08; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.start(t); o.stop(t + 0.12); }); }
  function sfxBonusLife() { const ac = initAudio(); if (!ac) return; [440, 554, 659, 880].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = 'triangle'; const t = ac.currentTime + i * 0.1; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15); o.start(t); o.stop(t + 0.15); }); }
  function sfxGameOver() { const ac = initAudio(); if (!ac) return; [392, 330, 262, 196].forEach((f, i) => { const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination); o.type = 'square'; const t = ac.currentTime + i * 0.2; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25); o.start(t); o.stop(t + 0.25); }); }

  // SPRITES
  const SPRITES = [
    { a:[[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,0,1,0,1,1],[1,1,1,1,1,1,1],[0,0,1,0,1,0,0],[0,1,0,0,0,1,0]], b:[[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[1,1,0,1,0,1,1],[1,1,1,1,1,1,1],[0,1,0,0,0,1,0],[1,0,0,0,0,0,1]] },
    { a:[[0,1,0,0,0,1,0],[0,0,1,0,1,0,0],[0,1,1,1,1,1,0],[1,1,0,1,0,1,1],[1,1,1,1,1,1,1],[0,1,1,1,1,1,0],[0,1,0,0,0,1,0],[1,0,0,0,0,0,1]], b:[[0,1,0,0,0,1,0],[1,0,1,0,1,0,1],[1,1,1,1,1,1,1],[1,1,0,1,0,1,1],[1,1,1,1,1,1,1],[0,0,1,0,1,0,0],[0,1,0,1,0,1,0],[0,0,0,0,0,0,0]] },
    { a:[[0,0,1,0,0,0,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[1,0,1,1,1,1,1,0,1],[1,0,1,0,0,0,1,0,1],[0,0,0,1,1,1,0,0,0]], b:[[0,0,1,0,0,0,1,0,0],[1,0,0,1,0,1,0,0,1],[1,0,1,1,1,1,1,0,1],[1,1,1,0,1,0,1,1,1],[1,1,1,1,1,1,1,1,1],[0,0,1,1,1,1,1,0,0],[0,0,1,0,0,0,1,0,0],[0,1,0,0,0,0,0,1,0]] },
    { a:[[0,0,0,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,0,0,0,1,1,1],[1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,1,0,0],[0,1,0,1,0,1,0,1,0],[1,0,1,0,0,0,1,0,1]], b:[[0,0,0,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,0,0,0,1,1,1],[1,1,1,1,1,1,1,1,1],[0,0,0,1,0,1,0,0,0],[0,0,1,0,0,0,1,0,0],[0,0,0,0,0,0,0,0,0]] },
    { a:[[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,1,0,0],[0,1,0,0,0,0,0,1,0],[0,0,1,0,0,0,1,0,0]], b:[[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,0,1,0,1,1,0],[1,1,1,1,1,1,1,1,1],[0,0,0,1,0,1,0,0,0],[0,0,1,0,0,0,1,0,0],[0,1,0,0,0,0,0,1,0]] },
    { a:[[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,0,0,1,0,1,0,0,1],[1,1,1,1,1,1,1,1,1],[0,0,1,0,0,0,1,0,0],[0,1,0,0,0,0,0,1,0]], b:[[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1],[1,0,0,1,0,1,0,0,1],[1,1,1,1,1,1,1,1,1],[0,1,0,0,0,0,0,1,0],[1,0,0,0,0,0,0,0,1]] },
  ];
  const CANNON_SPRITE = [[0,0,0,0,1,0,0,0,0],[0,0,0,1,1,1,0,0,0],[0,0,0,1,1,1,0,0,0],[0,1,1,1,1,1,1,1,0],[1,1,1,1,1,1,1,1,1],[1,1,1,1,1,1,1,1,1]];
  const EXPLOSION = [[0,0,1,0,0,0,1,0,0],[1,0,0,1,0,1,0,0,1],[0,1,0,0,0,0,0,1,0],[0,0,0,1,1,1,0,0,0],[1,1,0,1,1,1,0,1,1],[0,0,0,1,1,1,0,0,0],[0,1,0,0,0,0,0,1,0],[1,0,0,1,0,1,0,0,1],[0,0,1,0,0,0,1,0,0]];
  const UFO_SPRITE = [[0,0,0,0,1,1,1,1,0,0,0,0],[0,0,1,1,1,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,1,1,1,0],[1,0,1,0,1,0,1,0,1,0,1,0],[1,1,1,1,1,1,1,1,1,1,1,1],[0,0,1,1,1,0,0,1,1,1,0,0]];

  const ROW_COLORS = ['#d4e84b', '#6acd5b', '#3fbf7f', '#4da6ff', '#9966ff', '#ff6644'];
  const CANNON_COLOR = '#4dff4d', SHIELD_COLOR = '#4da6ff', UFO_COLOR = '#ff4444';
  const COLS = 6, ROWS = 6, ROW_POINTS = [30, 25, 20, 15, 10, 5];
  const INV_W = 9 * PX, INV_H = 8 * PX, GAP_X = 5 * PX, GAP_Y = 6 * PX;
  const CANNON_W = 9 * PX, CANNON_H = 6 * PX;
  const GROUND_Y = H - 38, PLAYER_Y = GROUND_Y - CANNON_H - 8;
  const UFO_SCORES = [50, 50, 100, 100, 100, 150, 150, 200, 200, 300];

  let invaders = [], shields = [], player = { x: W / 2 - CANNON_W / 2, hit: 0, invincible: 0 };
  let bullet = null, bulletTrail = [], bombs = [], explosions = [], particles = [], popups = [], ufo = null, stars = [];
  let sc = 0, lv = 3, wave = 0, running = true, started = false;
  let timer = 60, timerInterval = null, frame = 0, moveDir = 1, moveTimer = 0, stepCount = 0;
  let keys = {}, touchX = null, touchFiring = false, spaceDown = false;
  let shakeAmount = 0, waveTransition = 0, waveFlash = 0;
  let bonusAwarded = false, kills = 0, shots = 0, muzzleFlash = 0;
  let hiScore = parseInt(localStorage.getItem('si_high') || '0');

  function initInvaders(startWave) {
    invaders = [];
    const gridW = COLS * INV_W + (COLS - 1) * GAP_X;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) invaders.push({ r, c, x: (W - gridW) / 2 + c * (INV_W + GAP_X), y: 44 + r * (INV_H + GAP_Y) + Math.min(startWave, 4) * 8, alive: true, sprite: SPRITES[r], color: ROW_COLORS[r], points: ROW_POINTS[r], exploding: 0 });
  }
  function initShields() {
    shields = [];
    const SH_W = 44, SH_H = 26, shieldY = PLAYER_Y - 50, spacing = W / 4;
    for (let s = 0; s < 3; s++) { const sx = spacing * (s + 1) - SH_W / 2; for (let py = 0; py < SH_H; py += 2) for (let px = 0; px < SH_W; px += 2) { const inArch = py > SH_H * 0.58 && Math.abs(px - SH_W / 2) < SH_W * 0.24; if (!inArch) shields.push({ x: sx + px, y: shieldY + py, alive: true }); } }
  }
  function initStars() { stars = []; for (let i = 0; i < 50; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * 0.85, brightness: 0.08 + Math.random() * 0.2, speed: 0.01 + Math.random() * 0.03, phase: Math.random() * Math.PI * 2, size: Math.random() < 0.12 ? 2 : 1 }); }
  initInvaders(0); initShields(); initStars();

  function moveInterval() { const alive = invaders.filter(i => i.alive && i.exploding === 0).length; const base = Math.max(18 - wave * 2, 10); return Math.max(2, Math.floor(base * (alive / (ROWS * COLS)))); }
  function maxBombs() { return wave >= 3 ? 4 : wave >= 1 ? 3 : 2; }
  function bombDropRate() { return Math.min(0.45, 0.25 + wave * 0.05); }
  function bombSpeed() { return 2.0 + Math.min(wave, 4) * 0.25; }

  function drawSprite(sprite, x, y, color) { ctx.fillStyle = color; for (let r = 0; r < sprite.length; r++) for (let c = 0; c < sprite[r].length; c++) if (sprite[r][c]) ctx.fillRect(x + c * PX, y + r * PX, PX, PX); }
  function hexToRgba(hex, alpha) { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return `rgba(${r},${g},${b},${alpha})`; }
  function spawnParticles(x, y, color, count) { for (let i = 0; i < count; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, life: 15 + Math.random() * 15, color }); }
  function addKillPopup(x, y, text, color) { popups.push({ x, y, text, ttl: 35, color }); }
  function checkBonusLife() { if (!bonusAwarded && sc >= 1500) { bonusAwarded = true; lv++; lives = lv; sfxBonusLife(); popups.push({ x: W / 2, y: H / 2, text: '1UP!', ttl: 60, color: '#4dff4d' }); } }

  function fire() {
    if (!started) { started = true; initAudio(); timerInterval = setInterval(() => { timer--; timeLeft = timer; timerEl.textContent = `${timer}s`; timerEl.style.color = timer <= 10 ? '#c62828' : '#888'; if (timer <= 0) endGame(); }, 1000); }
    if (!bullet && player.hit === 0 && player.invincible <= 0 && waveTransition === 0) { bullet = { x: player.x + CANNON_W / 2, y: PLAYER_Y }; muzzleFlash = 4; shots++; sfxShoot(); }
  }

  function endGame() {
    if (!running) return;
    running = false;
    if (timerInterval) clearInterval(timerInterval);
    sfxUFOStop(); sfxGameOver(); shakeAmount = 6;
    const isNewHi = sc > hiScore;
    if (isNewHi) localStorage.setItem('si_high', String(sc));
    score = sc;
    finalStats = { score: sc, wave: wave + 1, kills, shots, accuracy: shots > 0 ? Math.round((kills / shots) * 100) : 0, hiScore: isNewHi ? sc : hiScore, isNewHi };
    setTimeout(() => showScoreScreen(), 1200);
  }

  function showScoreScreen() {
    cleanup();
    overlay.innerHTML = `
      <div class="si-score-card">
        <div style="font-size:48px;margin-bottom:8px">👾</div>
        <h2 style="color:#fff;margin-bottom:4px;letter-spacing:2px">GAME OVER</h2>
        <div class="si-score-num">${finalStats.score}</div>
        <p style="color:#888;margin-bottom:4px">points</p>
        ${finalStats.isNewHi ? '<div class="si-new-hi">NEW HIGH SCORE!</div>' : ''}
        <div class="si-stats-line">Wave ${finalStats.wave} &bull; ${finalStats.kills} invaders &bull; ${finalStats.accuracy}% accuracy</div>
        ${!finalStats.isNewHi ? `<div class="si-hi-score">High Score: ${finalStats.hiScore}</div>` : ''}
        <button class="si-close-btn">Back to Quiz</button>
      </div>
    `;
    overlay.querySelector('.si-close-btn').onclick = () => { overlay.remove(); if (onClose) onClose(); };
  }

  function respawnWave() {
    wave++; waveNum = wave + 1; waveTransition = 80; waveFlash = 12; sfxWaveClear();
    const gridW = COLS * INV_W + (COLS - 1) * GAP_X;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const idx = r * COLS + c; invaders[idx].alive = true; invaders[idx].exploding = 0; invaders[idx].x = (W - gridW) / 2 + c * (INV_W + GAP_X); invaders[idx].y = 44 + r * (INV_H + GAP_Y) + Math.min(wave, 4) * 8; }
    moveDir = 1; bombs = [];
  }

  // MAIN LOOP
  function loop() {
    if (!running) return;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); frame++;
    if (waveFlash > 0) { waveFlash--; ctx.fillStyle = `rgba(255,255,255,${waveFlash / 12 * 0.25})`; ctx.fillRect(0, 0, W, H); }
    const shaking = shakeAmount > 0.5;
    if (shaking) { ctx.save(); ctx.translate((Math.random() - 0.5) * shakeAmount, (Math.random() - 0.5) * shakeAmount); shakeAmount *= 0.88; }

    // Stars
    for (const s of stars) { s.phase += s.speed; ctx.fillStyle = `rgba(255,255,255,${Math.max(0, s.brightness + Math.sin(s.phase) * 0.06)})`; ctx.fillRect(s.x, s.y, s.size, s.size); }

    // Player
    if (player.hit > 0) { player.hit--; if (player.hit === 0) player.invincible = 50; }
    else {
      const spd = 4;
      if (keys['ArrowLeft'] || keys['a']) player.x = Math.max(4, player.x - spd);
      if (keys['ArrowRight'] || keys['d']) player.x = Math.min(W - CANNON_W - 4, player.x + spd);
      if (touchX !== null) { const target = touchX - CANNON_W / 2; player.x += (Math.max(4, Math.min(W - CANNON_W - 4, target)) - player.x) * 0.3; }
      if (player.invincible > 0) player.invincible--;
    }

    // Invaders
    if (started && waveTransition === 0) {
      moveTimer++;
      if (moveTimer >= moveInterval()) {
        moveTimer = 0; stepCount++; sfxMarch();
        let hitEdge = false;
        const alive = invaders.filter(i => i.alive && i.exploding === 0);
        const stepX = 4 + Math.max(0, 2 - Math.floor(alive.length / 8));
        for (const inv of alive) { inv.x += moveDir * stepX; if (inv.x <= 2 || inv.x + INV_W >= W - 2) hitEdge = true; }
        if (hitEdge) { moveDir *= -1; for (const inv of alive) { inv.x += moveDir * stepX; inv.y += 6 + Math.min(wave, 3); } }
        for (const inv of alive) if (inv.y + INV_H >= GROUND_Y) { endGame(); return; }
        if (alive.length > 0 && bombs.length < maxBombs()) {
          const bottomPerCol = {}; for (const inv of alive) if (!bottomPerCol[inv.c] || inv.r > bottomPerCol[inv.c].r) bottomPerCol[inv.c] = inv;
          if (Math.random() < bombDropRate()) { const shooter = Object.values(bottomPerCol)[Math.floor(Math.random() * Object.values(bottomPerCol).length)]; bombs.push({ x: shooter.x + INV_W / 2, y: shooter.y + INV_H, zigPhase: Math.random() * Math.PI * 2, type: Math.random() < 0.5 ? 'zigzag' : 'plunger' }); }
        }
      }
    }

    // UFO
    if (started && !ufo && waveTransition === 0 && Math.random() < 0.002) { const dir = Math.random() < 0.5 ? 1 : -1; ufo = { x: dir === 1 ? -40 : W + 40, dir }; sfxUFOStart(); }
    if (ufo) { ufo.x += ufo.dir * 1.5; if ((ufo.dir === 1 && ufo.x > W + 44) || (ufo.dir === -1 && ufo.x < -44)) { sfxUFOStop(); ufo = null; } }

    // Bullet
    if (bullet) {
      bulletTrail.push({ x: bullet.x, y: bullet.y, alpha: 0.5 }); bullet.y -= 8;
      if (bullet.y < 26) { bullet = null; }
      else {
        for (const inv of invaders) { if (!inv.alive || inv.exploding > 0) continue; if (bullet.x >= inv.x && bullet.x <= inv.x + INV_W && bullet.y >= inv.y && bullet.y <= inv.y + INV_H) { inv.exploding = 14; sc += inv.points; kills++; sfxExplode(); spawnParticles(inv.x + INV_W / 2, inv.y + INV_H / 2, inv.color, 8); addKillPopup(inv.x + INV_W / 2, inv.y, `+${inv.points}`, inv.color); checkBonusLife(); bullet = null; break; } }
        if (bullet && ufo && bullet.x >= ufo.x && bullet.x <= ufo.x + 36 && bullet.y >= 28 && bullet.y <= 46) { const us = UFO_SCORES[Math.floor(Math.random() * UFO_SCORES.length)]; sc += us; kills++; sfxExplode(); sfxUFOStop(); spawnParticles(ufo.x + 18, 38, UFO_COLOR, 12); addKillPopup(ufo.x + 18, 30, `+${us}`, '#ff8866'); explosions.push({ x: ufo.x + 8, y: 28, ttl: 20 }); ufo = null; bullet = null; checkBonusLife(); }
        if (bullet) { for (const sp of shields) { if (sp.alive && Math.abs(bullet.x - sp.x) < 3 && Math.abs(bullet.y - sp.y) < 3) { for (const sp2 of shields) if (sp2.alive && Math.abs(sp2.x - sp.x) < 5 && Math.abs(sp2.y - sp.y) < 4) sp2.alive = false; sfxShieldHit(); bullet = null; break; } } }
      }
    }

    // Trail / explosions / particles / popups
    for (let i = bulletTrail.length - 1; i >= 0; i--) { bulletTrail[i].alpha -= 0.08; if (bulletTrail[i].alpha <= 0) bulletTrail.splice(i, 1); }
    for (const inv of invaders) { if (inv.exploding > 0) { inv.exploding--; if (inv.exploding === 0) { inv.alive = false; if (invaders.every(i => !i.alive)) respawnWave(); } } }
    const bSpd = bombSpeed();
    for (let i = bombs.length - 1; i >= 0; i--) {
      const b = bombs[i]; b.y += bSpd; if (b.type === 'zigzag') b.x += Math.sin(b.y * 0.15 + b.zigPhase) * 0.8;
      let removed = false;
      for (const sp of shields) { if (sp.alive && Math.abs(b.x - sp.x) < 4 && Math.abs(b.y - sp.y) < 4) { for (const sp2 of shields) if (sp2.alive && Math.abs(sp2.x - sp.x) < 6 && Math.abs(sp2.y - sp.y) < 6) sp2.alive = false; sfxShieldHit(); bombs.splice(i, 1); removed = true; break; } }
      if (removed) continue;
      if (player.hit === 0 && player.invincible <= 0 && b.y >= PLAYER_Y && b.y <= PLAYER_Y + CANNON_H && b.x >= player.x && b.x <= player.x + CANNON_W) { bombs.splice(i, 1); lv--; lives = lv; player.hit = 50; shakeAmount = 10; sfxPlayerDeath(); spawnParticles(player.x + CANNON_W / 2, PLAYER_Y + CANNON_H / 2, CANNON_COLOR, 16); explosions.push({ x: player.x, y: PLAYER_Y, ttl: 24 }); if (lv <= 0) { endGame(); return; } continue; }
      if (b.y > H) bombs.splice(i, 1);
    }
    for (let i = explosions.length - 1; i >= 0; i--) { explosions[i].ttl--; if (explosions[i].ttl <= 0) explosions.splice(i, 1); }
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life--; if (p.life <= 0) particles.splice(i, 1); }
    for (let i = popups.length - 1; i >= 0; i--) { popups[i].y -= 0.8; popups[i].ttl--; if (popups[i].ttl <= 0) popups.splice(i, 1); }
    if (waveTransition > 0) waveTransition--;
    if (muzzleFlash > 0) muzzleFlash--;

    // DRAW
    for (const t of bulletTrail) { ctx.fillStyle = `rgba(255,255,255,${t.alpha * 0.4})`; ctx.fillRect(t.x - 1, t.y, PX, 6); }
    ctx.fillStyle = SHIELD_COLOR; for (const sp of shields) if (sp.alive) ctx.fillRect(sp.x, sp.y, 2, 2);
    for (const inv of invaders) { if (!inv.alive) continue; if (inv.exploding > 0) drawSprite(EXPLOSION, inv.x, inv.y, inv.exploding % 4 < 2 ? '#fff' : inv.color); else drawSprite(stepCount % 2 === 0 ? inv.sprite.a : inv.sprite.b, inv.x, inv.y, inv.color); }
    if (ufo) { drawSprite(UFO_SPRITE, ufo.x, 30, frame % 8 < 4 ? UFO_COLOR : '#ff8866'); ctx.fillStyle = 'rgba(255,68,68,0.15)'; ctx.fillRect(ufo.x - 4, 28, 44, 22); }
    if (player.hit === 0 || (player.hit > 0 && frame % 4 < 2)) { if (player.invincible <= 0 || frame % 4 < 2) { drawSprite(CANNON_SPRITE, player.x, PLAYER_Y, CANNON_COLOR); if (muzzleFlash > 0) { ctx.fillStyle = `rgba(255,255,200,${muzzleFlash / 4 * 0.7})`; ctx.fillRect(player.x + CANNON_W / 2 - 3, PLAYER_Y - 5, 6, 5); } } }
    if (bullet) { ctx.fillStyle = '#fff'; ctx.fillRect(bullet.x - 1, bullet.y, PX, 10); ctx.fillStyle = 'rgba(255,255,200,0.8)'; ctx.fillRect(bullet.x - 1, bullet.y - 2, PX, 3); }
    for (const b of bombs) { if (b.type === 'zigzag') { ctx.fillStyle = '#ff8a4d'; for (let yy = 0; yy < 12; yy += 2) ctx.fillRect(b.x - 1 + (yy % 4 < 2 ? -1 : 1), b.y + yy, PX, 2); } else { ctx.fillStyle = '#ffcc00'; ctx.fillRect(b.x - 1, b.y, PX, 10); ctx.fillRect(b.x - 3, b.y + 10, PX + 4, 2); } }
    for (const e of explosions) drawSprite(EXPLOSION, e.x, e.y, e.ttl % 4 < 2 ? '#fff' : '#ff8a4d');
    for (const p of particles) { ctx.fillStyle = hexToRgba(p.color, p.life / 30); ctx.fillRect(p.x, p.y, 2, 2); }
    for (const p of popups) { ctx.fillStyle = hexToRgba(p.color, Math.min(1, p.ttl / 15)); ctx.font = p.text === '1UP!' ? 'bold 16px monospace' : 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y); }
    ctx.fillStyle = timer <= 10 && frame % 20 < 10 ? '#ff4444' : CANNON_COLOR; ctx.fillRect(0, GROUND_Y, W, 2);

    // HUD
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left'; ctx.fillText(`SCORE  ${String(sc).padStart(5, '0')}`, 8, 18);
    ctx.fillStyle = '#666'; ctx.font = '9px monospace'; ctx.textAlign = 'center'; ctx.fillText(`HI ${String(Math.max(sc, hiScore)).padStart(5, '0')}`, W / 2, 10);
    ctx.fillStyle = '#888'; ctx.font = '9px monospace'; ctx.fillText(`WAVE ${wave + 1}`, W / 2, 22);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right'; ctx.fillText(`${lv}`, W - 8, 18);
    for (let i = 0; i < lv - 1; i++) { const lx = W - 26 - i * 22; ctx.fillStyle = CANNON_COLOR; ctx.fillRect(lx, 10, 15, 3); ctx.fillRect(lx + 6, 7, 3, 3); }
    if (started) { ctx.fillStyle = timer <= 10 ? (frame % 30 < 15 ? '#ff4444' : '#ff8866') : '#888'; ctx.font = timer <= 10 ? 'bold 14px monospace' : 'bold 12px monospace'; ctx.textAlign = 'right'; ctx.fillText(`${timer}s`, W - 8, GROUND_Y + 16); }
    if (!started) { ctx.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(frame * 0.06) * 0.3})`; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillText('TAP OR PRESS SPACE TO START', W / 2, H - 12); }
    if (waveTransition > 0) { const alpha = waveTransition > 60 ? 1 : waveTransition / 60; ctx.fillStyle = `rgba(255,255,255,${alpha * 0.08})`; ctx.fillRect(0, 0, W, H); ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.fillText(`WAVE ${wave + 1}`, W / 2, H / 2 - 10); ctx.font = '12px monospace'; ctx.fillText('GET READY', W / 2, H / 2 + 14); }
    if (shaking) ctx.restore();
    requestAnimationFrame(loop);
  }
  loop();

  // EVENT HANDLERS
  const handleKeyDown = (e) => { keys[e.key] = true; if ((e.key === ' ' || e.code === 'Space') && !spaceDown) { e.preventDefault(); spaceDown = true; fire(); } };
  const handleKeyUp = (e) => { keys[e.key] = false; if (e.key === ' ' || e.code === 'Space') spaceDown = false; };
  const handleTouch = (e) => { e.preventDefault(); fire(); const touch = e.touches[0]; if (!touch) return; const rect = canvas.getBoundingClientRect(); touchX = (touch.clientX - rect.left) * (W / rect.width); touchFiring = true; };
  const handleTouchMove = (e) => { e.preventDefault(); const touch = e.touches[0]; if (!touch) return; const rect = canvas.getBoundingClientRect(); touchX = (touch.clientX - rect.left) * (W / rect.width); };
  const handleTouchEnd = () => { touchX = null; touchFiring = false; };
  const fireInterval = setInterval(() => { if (touchFiring && started) fire(); }, 200);

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('touchstart', handleTouch, { passive: false });
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
  canvas.addEventListener('touchend', handleTouchEnd);

  function cleanup() {
    running = false;
    if (timerInterval) clearInterval(timerInterval);
    clearInterval(fireInterval);
    sfxUFOStop();
    try { if (audioCtx) audioCtx.close(); } catch(e) {}
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    canvas.removeEventListener('touchstart', handleTouch);
    canvas.removeEventListener('touchmove', handleTouchMove);
    canvas.removeEventListener('touchend', handleTouchEnd);
  }
}
