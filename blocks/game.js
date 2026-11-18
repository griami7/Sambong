// 블록 쌓기: 게임 규칙만 담은 순수 로직. 화면(DOM·canvas)을 건드리지 않는다.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BlockGame = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var W = 10;
  var H = 20;
  var TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  var SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };
  var LINE_SCORE = [0, 100, 300, 500, 800]; // 한 번에 지운 줄 수 → 기본 점수 (× 레벨)
  var KICKS = [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]; // 회전이 막히면 시도할 이동

  function cloneMatrix(m) {
    return m.map(function (row) { return row.slice(); });
  }

  // dir > 0: 시계 방향, dir < 0: 반시계 방향
  function rotateMatrix(m, dir) {
    var n = m.length;
    var out = [];
    for (var r = 0; r < n; r++) {
      out[r] = [];
      for (var c = 0; c < n; c++) out[r][c] = dir > 0 ? m[n - 1 - c][r] : m[c][n - 1 - r];
    }
    return out;
  }

  function emptyBoard() {
    var b = [];
    for (var r = 0; r < H; r++) b.push(new Array(W).fill(null));
    return b;
  }

  function collides(board, m, x, y) {
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m[r].length; c++) {
        if (!m[r][c]) continue;
        var gx = x + c;
        var gy = y + r;
        if (gx < 0 || gx >= W || gy >= H) return true;
        if (gy >= 0 && board[gy][gx]) return true;
      }
    }
    return false;
  }

  // 7개 한 묶음을 섞어 차례로 내놓는다 (같은 모양이 오래 안 나오는 일이 없게)
  function createBag(rng) {
    var rand = rng || Math.random;
    var queue = [];
    return function next() {
      if (queue.length === 0) {
        queue = TYPES.slice();
        for (var i = queue.length - 1; i > 0; i--) {
          var j = Math.floor(rand() * (i + 1));
          var t = queue[i]; queue[i] = queue[j]; queue[j] = t;
        }
      }
      return queue.shift();
    };
  }

  function makePiece(type) {
    var m = cloneMatrix(SHAPES[type]);
    return { type: type, m: m, x: Math.floor((W - m.length) / 2), y: 0 };
  }

  function spawn(game) {
    game.piece = makePiece(game.next);
    game.next = game.bag();
    if (collides(game.board, game.piece.m, game.piece.x, game.piece.y)) game.over = true;
  }

  function newGame(rng) {
    var game = { width: W, height: H, board: emptyBoard(), bag: createBag(rng), score: 0, lines: 0, level: 1, over: false, piece: null, next: null };
    game.next = game.bag();
    spawn(game);
    return game;
  }

  function move(game, dx) {
    if (game.over) return false;
    var p = game.piece;
    if (collides(game.board, p.m, p.x + dx, p.y)) return false;
    p.x += dx;
    return true;
  }

  // dir > 0: 시계, dir < 0: 반시계. 벽에 막히면 옆·위로 조금 밀어 본다.
  function rotate(game, dir) {
    if (game.over) return false;
    var p = game.piece;
    var m = rotateMatrix(p.m, dir);
    for (var i = 0; i < KICKS.length; i++) {
      var nx = p.x + KICKS[i][0];
      var ny = p.y + KICKS[i][1];
      if (!collides(game.board, m, nx, ny)) {
        p.m = m; p.x = nx; p.y = ny;
        return true;
      }
    }
    return false;
  }

  function clearLines(game) {
    var kept = game.board.filter(function (row) { return !row.every(Boolean); });
    var cleared = H - kept.length;
    while (kept.length < H) kept.unshift(new Array(W).fill(null));
    game.board = kept;
    return cleared;
  }

  function lock(game) {
    var p = game.piece;
    for (var r = 0; r < p.m.length; r++) {
      for (var c = 0; c < p.m[r].length; c++) {
        if (!p.m[r][c]) continue;
        var gy = p.y + r;
        if (gy < 0) { game.over = true; continue; }
        game.board[gy][p.x + c] = p.type;
      }
    }
    var cleared = clearLines(game);
    game.score += LINE_SCORE[cleared] * game.level;
    game.lines += cleared;
    game.level = 1 + Math.floor(game.lines / 10);
    if (!game.over) spawn(game);
    return cleared;
  }

  // 한 칸 내리기. 더 못 내려가면 굳힌다. 'moved' | 'locked' | 'over'
  function step(game) {
    if (game.over) return 'over';
    var p = game.piece;
    if (!collides(game.board, p.m, p.x, p.y + 1)) { p.y++; return 'moved'; }
    lock(game);
    return game.over ? 'over' : 'locked';
  }

  function softDrop(game) {
    var result = step(game);
    if (result === 'moved') game.score += 1;
    return result;
  }

  function hardDrop(game) {
    if (game.over) return 0;
    var p = game.piece;
    var cells = 0;
    while (!collides(game.board, p.m, p.x, p.y + 1)) { p.y++; cells++; }
    game.score += cells * 2;
    lock(game);
    return cells;
  }

  function ghostY(game) {
    var p = game.piece;
    var y = p.y;
    while (!collides(game.board, p.m, p.x, y + 1)) y++;
    return y;
  }

  // 레벨이 오를수록 빨라지는 자동 낙하 간격(ms)
  function dropInterval(level) {
    return Math.max(100, 800 - (level - 1) * 70);
  }

  return {
    WIDTH: W, HEIGHT: H, TYPES: TYPES, SHAPES: SHAPES,
    rotateMatrix: rotateMatrix, collides: collides, createBag: createBag, makePiece: makePiece,
    spawn: spawn, newGame: newGame, move: move, rotate: rotate, step: step,
    softDrop: softDrop, hardDrop: hardDrop, ghostY: ghostY, dropInterval: dropInterval
  };
});
