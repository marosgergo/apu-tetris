/**
 * APU TETRIS — game.js
 * Full Tetris engine: pieces, rotation, wall-kick, ghost, scoring,
 * levels, hold, next-queue, touch controls, keyboard, PWA install.
 * Zero ads. Pure fun.
 */

// ─── Constants ────────────────────────────────────────────────────────────────
const COLS  = 10;
const ROWS  = 20;
const HIDDEN = 2; // invisible rows above board

// Tetromino definitions [shape matrix, color-key]
const TETROMINOES = {
  I: { shape: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], color: 'I' },
  O: { shape: [[1,1],[1,1]],                               color: 'O' },
  T: { shape: [[0,1,0],[1,1,1],[0,0,0]],                  color: 'T' },
  S: { shape: [[0,1,1],[1,1,0],[0,0,0]],                  color: 'S' },
  Z: { shape: [[1,1,0],[0,1,1],[0,0,0]],                  color: 'Z' },
  J: { shape: [[1,0,0],[1,1,1],[0,0,0]],                  color: 'J' },
  L: { shape: [[0,0,1],[1,1,1],[0,0,0]],                  color: 'L' },
};
const PIECE_KEYS = Object.keys(TETROMINOES);

// SRS wall-kick tables
const WALL_KICKS = {
  default: [
    [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
  ],
  I: [
    [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
  ],
};

// Points per lines cleared
const LINE_POINTS = [0, 100, 300, 500, 800];
const LEVEL_LINES = 10; // lines per level

// Speed (ms per row drop)
function dropInterval(level) {
  return Math.max(80, 800 - (level - 1) * 70);
}

// CSS color variables
const COLOR_MAP = {
  I: '#00d4ff', O: '#ffd700', T: '#bf5af2',
  S: '#30d158', Z: '#ff453a', J: '#5e8ef7',
  L: '#ff9f0a', G: '#1e2d45',
};

// ─── Utility helpers ──────────────────────────────────────────────────────────
function rotateMatrix(mat) {
  const N = mat.length;
  return mat.map((row, r) => row.map((_, c) => mat[N - 1 - c][r]));
}

function randomBag() {
  // 7-bag randomiser
  const bag = [...PIECE_KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// ─── Game state ───────────────────────────────────────────────────────────────
class TetrisGame {
  constructor(canvas, nextCanvas, holdCanvas) {
    this.canvas     = canvas;
    this.ctx        = canvas.getContext('2d');
    this.nextCanvas = nextCanvas;
    this.nextCtx    = nextCanvas.getContext('2d');
    this.holdCanvas = holdCanvas;
    this.holdCtx    = holdCanvas.getContext('2d');

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.reset();
    this.bindInput();
  }

  resizeCanvas() {
    // Fit board to viewport height
    const maxH  = window.innerHeight;
    const maxW  = window.innerWidth;
    // Leave room: header ~60, score ~60, controls ~130, gaps ~30
    const availH = maxH - 60 - 40 - 130 - 30;
    const availW = maxW - 100 - 20; // side panel + margins
    this.cellSize = Math.floor(Math.min(availH / ROWS, availW / COLS, 32));
    this.cellSize = Math.max(this.cellSize, 18);

    this.canvas.width  = COLS * this.cellSize;
    this.canvas.height = ROWS * this.cellSize;

    const mini = Math.floor(this.cellSize * 0.85);
    this.nextCanvas.width  = 4 * mini + 4;
    this.nextCanvas.height = 4 * mini + 4;
    this.holdCanvas.width  = 4 * mini + 4;
    this.holdCanvas.height = 4 * mini + 4;
    this.miniCell = mini;
  }

  reset() {
    this.board    = Array.from({ length: ROWS + HIDDEN }, () => Array(COLS).fill(null));
    this.score    = 0;
    this.lines    = 0;
    this.level    = 1;
    this.bag      = [];
    this.nextPieces = this._fillBag();
    this.held     = null;
    this.holdUsed = false;
    this.gameOver = false;
    this.paused   = false;
    this.current  = this._spawn();
    this.lastDrop = performance.now();
    this.flashRows = [];
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(ts => this._loop(ts));
  }

  _fillBag() {
    if (this.bag.length < 7) this.bag.push(...randomBag());
    const next = [];
    for (let i = 0; i < 5; i++) next.push(this.bag.shift());
    return next;
  }

  _nextPiece() {
    if (this.bag.length < 5) this.bag.push(...randomBag());
    const key = this.bag.shift();
    this.nextPieces.push(key);
    return this.nextPieces.shift();
  }

  _spawn() {
    const key  = this._nextPiece();
    const def  = TETROMINOES[key];
    const piece = {
      key,
      shape: def.shape.map(r => [...r]),
      color: def.color,
      x: Math.floor((COLS - def.shape[0].length) / 2),
      y: -HIDDEN,
      rot: 0,
    };
    if (this._collides(piece.shape, piece.x, piece.y)) {
      this.gameOver = true;
    }
    this.holdUsed = false;
    return piece;
  }

  _collides(shape, ox, oy) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS) return true;
        if (ny >= ROWS + HIDDEN)  return true;
        if (ny >= 0 && this.board[ny][nx]) return true;
      }
    }
    return false;
  }

  _lock() {
    const { shape, x, y, color } = this.current;
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const ry = y + r;
        if (ry < 0) continue;
        this.board[ry][x + c] = color;
      }
    }
    this._clearLines();
    this.current = this._spawn();
  }

  _clearLines() {
    const full = [];
    for (let r = 0; r < this.board.length; r++) {
      if (this.board[r].every(c => c !== null)) full.push(r);
    }
    if (!full.length) return;

    // Flash effect
    this.flashRows = full;
    setTimeout(() => { this.flashRows = []; }, 160);

    full.forEach(r => {
      this.board.splice(r, 1);
      this.board.unshift(Array(COLS).fill(null));
    });

    const cleared = full.length;
    const pts = LINE_POINTS[cleared] * this.level;
    this.score += pts;
    this.lines += cleared;
    this.level = Math.floor(this.lines / LEVEL_LINES) + 1;

    // Update UI
    document.getElementById('score-val').textContent = this.score;
    document.getElementById('lines-val').textContent = this.lines;
    document.getElementById('level-val').textContent = this.level;
  }

  // SRS rotation with wall-kicks
  _tryRotate(dir) {
    const p    = this.current;
    const kicks = p.key === 'I' ? WALL_KICKS.I : WALL_KICKS.default;
    const fromRot = p.rot;
    const toRot   = (fromRot + dir + 4) % 4;

    let newShape = p.shape;
    const times = dir === 1 ? 1 : 3;
    for (let i = 0; i < times; i++) newShape = rotateMatrix(newShape);

    const tests = dir === 1 ? kicks[fromRot] : kicks[toRot].map(([x, y]) => [-x, -y]);
    for (const [kx, ky] of tests) {
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

  moveLeft()  { if (!this._collides(this.current.shape, this.current.x - 1, this.current.y)) this.current.x--; }
  moveRight() { if (!this._collides(this.current.shape, this.current.x + 1, this.current.y)) this.current.x++; }
  softDrop()  {
    if (!this._collides(this.current.shape, this.current.x, this.current.y + 1)) {
      this.current.y++;
      this.score += 1;
      document.getElementById('score-val').textContent = this.score;
    } else {
      this._lock();
    }
    this.lastDrop = performance.now();
  }

  hardDrop() {
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

  rotateRight() { this._tryRotate(1); }
  rotateLeft()  { this._tryRotate(-1); }

  holdPiece() {
    if (this.holdUsed) return;
    if (!this.held) {
      this.held = this.current.key;
      this.current = this._spawn();
    } else {
      const tmp = this.held;
      this.held = this.current.key;
      const def = TETROMINOES[tmp];
      this.current = {
        key: tmp, shape: def.shape.map(r => [...r]), color: def.color,
        x: Math.floor((COLS - def.shape[0].length) / 2),
        y: -HIDDEN, rot: 0,
      };
    }
    this.holdUsed = true;
  }

  _ghostY() {
    let gy = this.current.y;
    while (!this._collides(this.current.shape, this.current.x, gy + 1)) gy++;
    return gy;
  }

  // ─── Main loop ─────────────────────────────────────────────────────────────
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
      this._showGameOver();
    }
    this._raf = requestAnimationFrame(t => this._loop(t));
  }

  // ─── Drawing ───────────────────────────────────────────────────────────────
  _draw() {
    const ctx  = this.ctx;
    const cs   = this.cellSize;
    const W    = this.canvas.width;
    const H    = this.canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * cs, 0); ctx.lineTo(c * cs, H); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cs); ctx.lineTo(W, r * cs); ctx.stroke();
    }

    // Locked cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const color = this.board[r + HIDDEN][c];
        if (color) {
          const flash = this.flashRows.includes(r + HIDDEN);
          this._drawCell(ctx, c, r, color, flash ? 0.2 : 1, cs);
        }
      }
    }

    // Ghost piece
    const gy = this._ghostY();
    for (let r = 0; r < this.current.shape.length; r++) {
      for (let c = 0; c < this.current.shape[r].length; c++) {
        if (!this.current.shape[r][c]) continue;
        const gRow = gy + r - HIDDEN;
        if (gRow < 0 || gRow >= ROWS) continue;
        this._drawCell(ctx, this.current.x + c, gRow, this.current.color, 0.18, cs);
      }
    }

    // Current piece
    for (let r = 0; r < this.current.shape.length; r++) {
      for (let c = 0; c < this.current.shape[r].length; c++) {
        if (!this.current.shape[r][c]) continue;
        const row = this.current.y + r - HIDDEN;
        if (row < 0 || row >= ROWS) continue;
        this._drawCell(ctx, this.current.x + c, row, this.current.color, 1, cs);
      }
    }

    // Next pieces
    this._drawNextAndHold();
  }

  _drawCell(ctx, col, row, colorKey, alpha, cs) {
    const color = COLOR_MAP[colorKey] || '#fff';
    const x = col * cs + 1;
    const y = row * cs + 1;
    const s = cs - 2;

    ctx.globalAlpha = alpha;

    // Fill
    const grad = ctx.createLinearGradient(x, y, x + s, y + s);
    grad.addColorStop(0, color + 'ff');
    grad.addColorStop(1, color + '99');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, s, s, 3) : ctx.rect(x, y, s, s);
    ctx.fill();

    // Glow
    if (alpha > 0.5) {
      ctx.shadowColor  = color;
      ctx.shadowBlur   = 8;
      ctx.fillStyle    = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, s, Math.floor(s * 0.35), 3) : ctx.rect(x, y, s, Math.floor(s * 0.35));
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
  }

  _drawMini(ctx, key, size) {
    if (!key) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    const def   = TETROMINOES[key];
    const shape = def.shape;
    const rows  = shape.length;
    const cols  = shape[0].length;
    const offsetX = Math.floor((4 - cols) / 2) * size;
    const offsetY = Math.floor((4 - rows) / 2) * size;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!shape[r][c]) continue;
        this._drawCell(ctx, 0, 0, def.color, 1, size);
        // Re-draw at correct position manually
        const color = COLOR_MAP[def.color];
        const x = offsetX + c * size + 1;
        const y = offsetY + r * size + 1;
        const s = size - 2;
        ctx.globalAlpha = 1;
        const grad = ctx.createLinearGradient(x, y, x + s, y + s);
        grad.addColorStop(0, color + 'ff');
        grad.addColorStop(1, color + '99');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, s, s, 3) : ctx.rect(x, y, s, s);
        ctx.fill();
        ctx.shadowColor = color; ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(x, y, s, Math.floor(s * 0.35), 3) : ctx.rect(x, y, s, Math.floor(s * 0.35));
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  _drawNextAndHold() {
    // Next (first in queue)
    this._drawMini(this.nextCtx, this.nextPieces[0], this.miniCell);
    // Hold
    this._drawMini(this.holdCtx, this.held, this.miniCell);
  }

  // ─── Overlays ──────────────────────────────────────────────────────────────
  _showGameOver() {
    document.getElementById('overlay-title').textContent  = 'GAME OVER';
    document.getElementById('overlay-sub').textContent    = 'Végeredmény:';
    document.getElementById('overlay-score').textContent  = this.score;
    document.getElementById('btn-overlay-play').textContent = 'ÚJ JÁTÉK';
    document.getElementById('btn-overlay-play').onclick   = () => {
      document.getElementById('overlay').classList.add('hidden');
      this.reset();
    };
    document.getElementById('btn-overlay-resume').style.display = 'none';
    document.getElementById('overlay').classList.remove('hidden');
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    const ov = document.getElementById('overlay');
    if (this.paused) {
      document.getElementById('overlay-title').textContent = 'SZÜNET';
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
      this.lastDrop = performance.now();
    }
  }

  // ─── Input ─────────────────────────────────────────────────────────────────
  bindInput() {
    // Keyboard
    document.addEventListener('keydown', e => {
      if (this.gameOver) return;
      switch (e.code) {
        case 'ArrowLeft':  e.preventDefault(); this.moveLeft();    break;
        case 'ArrowRight': e.preventDefault(); this.moveRight();   break;
        case 'ArrowDown':  e.preventDefault(); this.softDrop();    break;
        case 'ArrowUp':    e.preventDefault(); this.rotateRight(); break;
        case 'KeyZ':       e.preventDefault(); this.rotateLeft();  break;
        case 'Space':      e.preventDefault(); this.hardDrop();    break;
        case 'KeyC':       e.preventDefault(); this.holdPiece();   break;
        case 'Escape': case 'KeyP': e.preventDefault(); this.togglePause(); break;
      }
    });

    // Touch swipe & tap on the canvas
    this._bindSwipe();

    // Buttons
    document.getElementById('btn-left').addEventListener('pointerdown',   e => { e.preventDefault(); this.moveLeft(); });
    document.getElementById('btn-right').addEventListener('pointerdown',  e => { e.preventDefault(); this.moveRight(); });
    document.getElementById('btn-down').addEventListener('pointerdown',   e => { e.preventDefault(); this.softDrop(); });
    document.getElementById('btn-rotate').addEventListener('pointerdown', e => { e.preventDefault(); this.rotateRight(); });
    document.getElementById('btn-drop').addEventListener('pointerdown',   e => { e.preventDefault(); this.hardDrop(); });
    document.getElementById('btn-hold').addEventListener('pointerdown',   e => { e.preventDefault(); this.holdPiece(); });
    document.getElementById('btn-pause').addEventListener('pointerdown',  e => { e.preventDefault(); this.togglePause(); });
    document.getElementById('btn-restart').addEventListener('pointerdown',e => { e.preventDefault(); this.reset(); });

    // Auto-repeat for left/right
    this._bindRepeat('btn-left',  () => this.moveLeft());
    this._bindRepeat('btn-right', () => this.moveRight());
    this._bindRepeat('btn-down',  () => this.softDrop());
  }

  _bindRepeat(id, fn) {
    const el = document.getElementById(id);
    let timer = null;
    let interval = null;
    const start = (e) => {
      e.preventDefault();
      fn();
      timer = setTimeout(() => { interval = setInterval(fn, 60); }, 160);
    };
    const stop = () => { clearTimeout(timer); clearInterval(interval); };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup',   stop);
    el.addEventListener('pointerleave',stop);
    el.addEventListener('pointercancel', stop);
  }

  _bindSwipe() {
    let sx = 0, sy = 0, moved = false;
    const canvas = this.canvas;

    canvas.addEventListener('touchstart', e => {
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      moved = false;
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      const dx = e.touches[0].clientX - sx;
      const dy = e.touches[0].clientY - sy;
      const threshold = 18;
      if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
        moved = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) this.moveRight(); else this.moveLeft();
        } else {
          if (dy > 0) this.softDrop();
        }
        sx = e.touches[0].clientX;
        sy = e.touches[0].clientY;
      }
      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      if (!moved) this.rotateRight(); // tap = rotate
      e.preventDefault();
    }, { passive: false });
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  const canvas      = document.getElementById('tetris-canvas');
  const nextCanvas  = document.getElementById('next-canvas');
  const holdCanvas  = document.getElementById('hold-canvas');

  const game = new TetrisGame(canvas, nextCanvas, holdCanvas);

  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // PWA Install Banner
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-banner').classList.add('show');
  });

  document.getElementById('btn-install').addEventListener('click', () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(() => {
      deferredPrompt = null;
      document.getElementById('install-banner').classList.remove('show');
    });
  });

  document.getElementById('btn-dismiss').addEventListener('click', () => {
    document.getElementById('install-banner').classList.remove('show');
  });
});
