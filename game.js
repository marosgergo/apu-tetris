/**
 * APU TETRIS — game.js
 * Reklámtalan Tetris: SRS forgatás, 7-bag, ghost piece, pontozás, szintek.
 */

// ─── Konstansok ───────────────────────────────────────────────────────────────
const COLS   = 10;
const ROWS   = 20;
const HIDDEN = 2; // láthatatlan sorok a tábla tetején (spawn zóna)

// Tetromino definíciók
const TETROMINOES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: '#00d4ff' },
  O: { shape: [[1,1],[1,1]],                               color: '#ffd700' },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]],                  color: '#bf5af2' },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]],                  color: '#30d158' },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]],                  color: '#ff453a' },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]],                  color: '#5e8ef7' },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]],                  color: '#ff9f0a' },
};
const PIECE_KEYS = Object.keys(TETROMINOES);

// SRS wall-kick táblázatok
const WALL_KICKS_JLSTZ = [
  [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],  // 0→1
  [[0,0],[1,0],[1,-1],[0,2],[1,2]],       // 1→2
  [[0,0],[1,0],[1,1],[0,-2],[1,-2]],      // 2→3
  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],   // 3→0
];
const WALL_KICKS_I = [
  [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],    // 0→1
  [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],    // 1→2
  [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],    // 2→3
  [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],    // 3→0
];

// Pontok soronként
const LINE_POINTS = [0, 100, 300, 500, 800];
const LEVEL_LINES = 10;

function dropInterval(level) {
  return Math.max(80, 800 - (level - 1) * 70);
}

// ─── 7-bag véletlenszerűség ────────────────────────────────────────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newBag() {
  return shuffle([...PIECE_KEYS]);
}

// ─── Mátrix forgatás ──────────────────────────────────────────────────────────
function rotateCW(mat) {
  const N = mat.length;
  return Array.from({ length: N }, (_, r) =>
    Array.from({ length: mat[0].length }, (__, c) => mat[N - 1 - c][r])
  );
}

// ─── Fő osztály ───────────────────────────────────────────────────────────────
class TetrisGame {
  constructor(boardCanvas, nextCanvas) {
    this.canvas     = boardCanvas;
    this.ctx        = boardCanvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx    = nextCanvas.getContext('2d');

    this._calcSize();
    window.addEventListener('resize', () => {
      this._calcSize();
      this._applyCanvasSizes();
    });
    this._applyCanvasSizes();

    this.reset();
    this._bindInput();
  }

  // ─── Méretszámítás ─────────────────────────────────────────────────────────
  _calcSize() {
    // Elérhető magasság: viewport − fejléc (~44px) − gombsor (~126px) − rések/padding (~24px)
    const availH = window.innerHeight - 44 - 126 - 24;
    // Elérhető szélesség: viewport − oldalpanel (~86px) − rések (~16px)
    const availW = window.innerWidth - 86 - 16;
    this.cellSize = Math.max(16, Math.floor(Math.min(availH / ROWS, availW / COLS, 44)));
    this.miniCell = Math.max(14, Math.floor(this.cellSize * 0.72));
  }

  _applyCanvasSizes() {
    this.canvas.width  = COLS * this.cellSize;
    this.canvas.height = ROWS * this.cellSize;
    // Next canvas: 4×4 mini grid
    const ms = this.miniCell;
    this.nextCanvas.width  = 4 * ms;
    this.nextCanvas.height = 4 * ms;
  }

  // ─── Reset / új játék ──────────────────────────────────────────────────────
  reset() {
    this.board     = Array.from({ length: ROWS + HIDDEN }, () => Array(COLS).fill(null));
    this.score     = 0;
    this.lines     = 0;
    this.level     = 1;
    this.gameOver  = false;
    this.paused    = false;
    this.flashRows = [];

    // Bag-ek inicializálása
    this._bag = newBag();
    this._nextBag = newBag();

    // Queue: 3 következő elem
    this._queue = [this._drawFromBag(), this._drawFromBag(), this._drawFromBag()];

    this.current   = this._spawn();
    this.lastDrop  = performance.now();

    // UI reset
    document.getElementById('score-val').textContent = '0';
    document.getElementById('lines-val').textContent = '0';
    document.getElementById('level-val').textContent = '1';

    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  // Következő elem kivétele a bag-ből (két bag: ha az első kiürül, a másodikból tölt)
  _drawFromBag() {
    if (this._bag.length === 0) {
      this._bag = this._nextBag;
      this._nextBag = newBag();
    }
    return this._bag.shift();
  }

  // Spawnol egy új darabot a queue elejéről
  _spawn() {
    const key = this._queue.shift();
    this._queue.push(this._drawFromBag());

    const def = TETROMINOES[key];
    const piece = {
      key,
      shape: def.shape.map(r => [...r]),
      color: def.color,
      x: Math.floor((COLS - def.shape[0].length) / 2),
      y: -HIDDEN,
      rot: 0,
    };

    // Game over: ütközés spawnkor
    if (this._collides(piece.shape, piece.x, piece.y + HIDDEN)) {
      this.gameOver = true;
    }
    return piece;
  }

  // ─── Ütközésvizsgálat ──────────────────────────────────────────────────────
  _collides(shape, ox, oy) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS)        return true;
        if (ny >= ROWS + HIDDEN)         return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  // ─── Lezárás ───────────────────────────────────────────────────────────────
  _lock() {
    const { shape, x, y, color } = this.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const ry = y + r;
        if (ry >= 0) this.board[ry][x + c] = color;
      }
    }
    this._clearLines();
    this.current = this._spawn();
  }

  // ─── Sorok törlése ─────────────────────────────────────────────────────────
  _clearLines() {
    const fullRows = [];
    for (let r = 0; r < this.board.length; r++) {
      if (this.board[r].every(c => c !== null)) fullRows.push(r);
    }
    if (!fullRows.length) return;

    this.flashRows = fullRows;
    setTimeout(() => { this.flashRows = []; }, 150);

    // Sorokat törlünk és felülre üres sort szúrunk
    for (const r of [...fullRows].reverse()) {
      this.board.splice(r, 1);
      this.board.unshift(Array(COLS).fill(null));
    }

    const n = fullRows.length;
    this.score += LINE_POINTS[n] * this.level;
    this.lines += n;
    this.level  = Math.floor(this.lines / LEVEL_LINES) + 1;

    document.getElementById('score-val').textContent = this.score;
    document.getElementById('lines-val').textContent = this.lines;
    document.getElementById('level-val').textContent = this.level;
  }

  // ─── Forgatás (SRS) ────────────────────────────────────────────────────────
  _tryRotate(dir) {
    const p       = this.current;
    const kicks   = p.key === 'I' ? WALL_KICKS_I : WALL_KICKS_JLSTZ;
    const fromRot = p.rot;
    const toRot   = (fromRot + dir + 4) % 4;

    // Forgatjuk a mátrixot
    const times = ((dir % 4) + 4) % 4 || 0;
    let newShape = p.shape;
    const steps  = dir === 1 ? 1 : 3; // 1 CW vagy 3× CW = 1 CCW
    for (let i = 0; i < steps; i++) newShape = rotateCW(newShape);

    // Kick tesztek
    const testKicks = dir === 1
      ? kicks[fromRot]
      : kicks[toRot].map(([kx, ky]) => [-kx, -ky]);

    for (const [kx, ky] of testKicks) {
      if (!this._collides(newShape, p.x + kx, p.y + ky)) {
        p.shape = newShape;
        p.x    += kx;
        p.y    += ky;
        p.rot   = toRot;
        return true;
      }
    }
    return false;
  }

  // ─── Mozgások ──────────────────────────────────────────────────────────────
  moveLeft()  {
    if (!this.paused && !this.gameOver)
      if (!this._collides(this.current.shape, this.current.x - 1, this.current.y))
        this.current.x--;
  }

  moveRight() {
    if (!this.paused && !this.gameOver)
      if (!this._collides(this.current.shape, this.current.x + 1, this.current.y))
        this.current.x++;
  }

  softDrop() {
    if (this.paused || this.gameOver) return;
    if (!this._collides(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score++;
      document.getElementById('score-val').textContent = this.score;
    } else {
      this._lock();
    }
    this.lastDrop = performance.now();
  }

  hardDrop() {
    if (this.paused || this.gameOver) return;
    let dist = 0;
    while (!this._collides(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      dist++;
    }
    this.score += dist * 2;
    document.getElementById('score-val').textContent = this.score;
    this._lock();
    this.lastDrop = performance.now();
  }

  rotateRight() { if (!this.paused && !this.gameOver) this._tryRotate(1); }
  rotateLeft()  { if (!this.paused && !this.gameOver) this._tryRotate(-1); }

  // ─── Ghost piece (vetítés) ─────────────────────────────────────────────────
  _ghostY() {
    let gy = this.current.y;
    while (!this._collides(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  // ─── Fő loop ───────────────────────────────────────────────────────────────
  _loop(ts) {
    if (!this.gameOver && !this.paused) {
      if (ts - this.lastDrop > dropInterval(this.level)) {
        if (!this._collides(this.current.shape, this.current.x, this.current.y + 1)) {
          this.current.y++;
        } else {
          this._lock();
        }
        this.lastDrop = ts;
      }
    }

    this._draw();

    if (this.gameOver) {
      cancelAnimationFrame(this._raf);
      this._showGameOver();
      return;
    }

    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  // ─── Rajzolás: főtábla ─────────────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    const cs  = this.cellSize;
    const W   = this.canvas.width;
    const H   = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Rácsvonalak
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth   = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * cs, 0); ctx.lineTo(c * cs, H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cs); ctx.lineTo(W, r * cs); ctx.stroke();
    }

    // Lezárt cellák (a HIDDEN-t kihagyjuk – a tábla [HIDDEN..HIDDEN+ROWS] indexű)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = this.board[r + HIDDEN][c];
        if (!color) continue;
        const flash = this.flashRows.includes(r + HIDDEN);
        this._drawCell(ctx, c * cs, r * cs, color, flash ? 0.15 : 1, cs);
      }
    }

    // Ghost
    const gy = this._ghostY();
    for (let r = 0; r < this.current.shape.length; r++) {
      for (let c = 0; c < this.current.shape[r].length; c++) {
        if (!this.current.shape[r][c]) continue;
        const drawRow = gy + r - HIDDEN;
        if (drawRow < 0 || drawRow >= ROWS) continue;
        this._drawCell(ctx, (this.current.x + c) * cs, drawRow * cs, this.current.color, 0.15, cs);
      }
    }

    // Aktív darab
    for (let r = 0; r < this.current.shape.length; r++) {
      for (let c = 0; c < this.current.shape[r].length; c++) {
        if (!this.current.shape[r][c]) continue;
        const drawRow = this.current.y + r - HIDDEN;
        if (drawRow < 0 || drawRow >= ROWS) continue;
        this._drawCell(ctx, (this.current.x + c) * cs, drawRow * cs, this.current.color, 1, cs);
      }
    }

    // Next piece előnézet
    this._drawNext();
  }

  // ─── Egy cella rajzolása ───────────────────────────────────────────────────
  // px, py: pixelkoordináta (nem grid index!)
  _drawCell(ctx, px, py, color, alpha, cs) {
    const x = px + 1;
    const y = py + 1;
    const s = cs - 2;
    if (s <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Alap szín
    const grad = ctx.createLinearGradient(x, y, x + s, y + s);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '88');
    ctx.fillStyle = grad;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, s, s, 3);
    else ctx.rect(x, y, s, s);
    ctx.fill();

    // Glow + highlight (csak teli alpha esetén)
    if (alpha > 0.5) {
      ctx.shadowColor = color;
      ctx.shadowBlur  = 10;
      const hh = Math.max(2, Math.floor(s * 0.32));
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, s, hh, [3, 3, 0, 0]);
      else ctx.rect(x, y, s, hh);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ─── Next piece rajzolása ──────────────────────────────────────────────────
  _drawNext() {
    const ctx  = this.nextCtx;
    const ms   = this.miniCell;
    const key  = this._queue[0];
    const def  = TETROMINOES[key];

    ctx.clearRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

    if (!def) return;

    const shape = def.shape;
    // Számítsuk meg a tényleges méreteket (az I 4 széles, a többi 3 vagy 2)
    const usedCols = shape[0].length;
    const usedRows = shape.length;

    // Középre igazítás a 4×4 területen
    const offX = Math.floor((4 - usedCols) / 2) * ms;
    const offY = Math.floor((4 - usedRows) / 2) * ms;

    for (let r = 0; r < usedRows; r++) {
      for (let c = 0; c < usedCols; c++) {
        if (!shape[r][c]) continue;
        this._drawCell(ctx, offX + c * ms, offY + r * ms, def.color, 1, ms);
      }
    }
  }

  // ─── Overlays ──────────────────────────────────────────────────────────────
  _showGameOver() {
    const ov = document.getElementById('overlay');
    document.getElementById('overlay-title').textContent = 'GAME OVER';
    document.getElementById('overlay-sub').textContent   = 'Végeredmény:';
    document.getElementById('overlay-score').textContent = this.score;
    document.getElementById('btn-overlay-resume').style.display = 'none';
    document.getElementById('btn-overlay-play').textContent     = 'ÚJ JÁTÉK';
    document.getElementById('btn-overlay-play').onclick = () => {
      ov.classList.add('hidden');
      this.reset();
    };
    ov.classList.remove('hidden');
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    const ov = document.getElementById('overlay');

    if (this.paused) {
      document.getElementById('overlay-title').textContent = 'SZÜNET ⏸';
      document.getElementById('overlay-sub').textContent   = '';
      document.getElementById('overlay-score').textContent = '';

      const btnResume = document.getElementById('btn-overlay-resume');
      btnResume.style.display = '';
      btnResume.onclick = () => { this.togglePause(); };

      document.getElementById('btn-overlay-play').textContent = 'ÚJ JÁTÉK';
      document.getElementById('btn-overlay-play').onclick = () => {
        ov.classList.add('hidden');
        this.paused = false;
        this.reset();
      };
      ov.classList.remove('hidden');
    } else {
      ov.classList.add('hidden');
      this.lastDrop = performance.now(); // ne ugorjon at az idő
    }
  }

  // ─── Input ─────────────────────────────────────────────────────────────────
  _bindInput() {
    // Billentyűzet
    document.addEventListener('keydown', e => {
      switch (e.code) {
        case 'ArrowLeft':  e.preventDefault(); this.moveLeft();    break;
        case 'ArrowRight': e.preventDefault(); this.moveRight();   break;
        case 'ArrowDown':  e.preventDefault(); this.softDrop();    break;
        case 'ArrowUp':    e.preventDefault(); this.rotateRight(); break;
        case 'KeyZ':       e.preventDefault(); this.rotateLeft();  break;
        case 'Space':      e.preventDefault(); this.hardDrop();    break;
        case 'KeyP':
        case 'Escape':     e.preventDefault(); this.togglePause(); break;
      }
    });

    // Canvas: swipe és tap
    this._bindSwipe();

    // Gombok
    this._btn('btn-left',    () => this.moveLeft(),    true);
    this._btn('btn-right',   () => this.moveRight(),   true);
    this._btn('btn-down',    () => this.softDrop(),    true);
    this._btn('btn-rotate',  () => this.rotateRight(), false);
    this._btn('btn-pause',   () => this.togglePause(), false);
    this._btn('btn-restart', () => {
      if (!this.gameOver && this.score > 0) {
        if (!confirm('Biztosan új játékot kezdesz?')) return;
      }
      this.reset();
    }, false);
  }

  // Gomb bekötése (opcionálisan auto-repeat)
  _btn(id, fn, repeat) {
    const el = document.getElementById(id);
    if (!el) return;

    if (!repeat) {
      el.addEventListener('pointerdown', e => { e.preventDefault(); fn(); });
      return;
    }

    let timer = null, iv = null;
    const start = e => {
      e.preventDefault();
      fn();
      timer = setTimeout(() => { iv = setInterval(fn, 55); }, 200);
    };
    const stop = () => { clearTimeout(timer); clearInterval(iv); timer = null; iv = null; };

    el.addEventListener('pointerdown',  start);
    el.addEventListener('pointerup',    stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('pointercancel', stop);
  }

  // Érintéses csúsztatás a canvas-on
  _bindSwipe() {
    let sx = 0, sy = 0, moved = false;

    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      moved = false;
    }, { passive: false });

    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      if (Math.abs(dx) > 20 || Math.abs(dy) > 20) {
        moved = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          dx > 0 ? this.moveRight() : this.moveLeft();
        } else if (dy > 0) {
          this.softDrop();
        }
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (!moved) this.rotateRight(); // tap = forgat
    }, { passive: false });
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const game = new TetrisGame(
    document.getElementById('tetris-canvas'),
    document.getElementById('next-canvas')
  );

  // PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // PWA telepítési banner
  let deferredPrompt = null;
  const banner = document.getElementById('install-banner');
  const isDismissed = localStorage.getItem('apu-tetris-install-dismissed');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

  if (!isDismissed && !isStandalone) {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      banner.classList.add('show');
    });
  }

  document.getElementById('btn-install').addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      banner.classList.remove('show');
      localStorage.setItem('apu-tetris-install-dismissed', '1');
    });
  });

  document.getElementById('btn-dismiss').addEventListener('click', () => {
    banner.classList.remove('show');
    localStorage.setItem('apu-tetris-install-dismissed', '1');
  });
});
