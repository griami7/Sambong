'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../game.js');

// 시험용 고정 난수
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// 마지막 열(9)만 비운 채 아래 n줄을 채운다
function fillRowsExceptLastCol(game, n) {
  for (let r = G.HEIGHT - n; r < G.HEIGHT; r++) {
    for (let c = 0; c < G.WIDTH - 1; c++) game.board[r][c] = 'X';
  }
}

// 세로로 세운 I 를 9열에 놓는다 (시계 방향 회전하면 3번째 칸 열에 세로로 선다)
function verticalIAtLastCol(game) {
  game.piece = G.makePiece('I');
  G.rotate(game, 1);
  game.piece.x = G.WIDTH - 3;
  game.piece.y = 0;
}

test('모양 7종이 모두 있고 칸 수는 4개씩이다', () => {
  assert.deepEqual([...G.TYPES].sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  for (const t of G.TYPES) {
    assert.equal(G.SHAPES[t].flat().filter(Boolean).length, 4, t);
  }
});

test('회전: 시계 방향 4번이면 제자리, 시계 뒤 반시계면 원래대로', () => {
  for (const t of G.TYPES) {
    let m = G.SHAPES[t];
    for (let i = 0; i < 4; i++) m = G.rotateMatrix(m, 1);
    assert.deepEqual(m, G.SHAPES[t], t);
    assert.deepEqual(G.rotateMatrix(G.rotateMatrix(G.SHAPES[t], 1), -1), G.SHAPES[t], t);
  }
  assert.deepEqual(G.rotateMatrix(G.SHAPES.T, 1), [[0, 1, 0], [0, 1, 1], [0, 1, 0]]);
});

test('충돌: 벽·바닥·쌓인 블록', () => {
  const g = G.newGame(seeded(1));
  const o = G.SHAPES.O;
  assert.equal(G.collides(g.board, o, 0, 0), false);
  assert.equal(G.collides(g.board, o, -1, 0), true);
  assert.equal(G.collides(g.board, o, G.WIDTH - 1, 0), true);
  assert.equal(G.collides(g.board, o, 0, G.HEIGHT - 1), true);
  assert.equal(G.collides(g.board, o, 0, G.HEIGHT - 2), false);
  g.board[5][3] = 'X';
  assert.equal(G.collides(g.board, o, 2, 4), true);
  assert.equal(G.collides(g.board, o, 4, 4), false);
});

test('가방: 7개씩 끊으면 모양이 하나씩 모두 나온다', () => {
  const next = G.createBag(seeded(42));
  for (let round = 0; round < 3; round++) {
    const got = Array.from({ length: 7 }, next).sort();
    assert.deepEqual(got, [...G.TYPES].sort());
  }
});

test('새 게임: 점수 0 · 레벨 1, 맨 위 가운데에서 시작', () => {
  const g = G.newGame(seeded(3));
  assert.deepEqual([g.score, g.lines, g.level, g.over], [0, 0, 1, false]);
  assert.equal(g.piece.y, 0);
  assert.equal(g.piece.x, Math.floor((G.WIDTH - g.piece.m.length) / 2));
  assert.ok(G.TYPES.includes(g.next));
});

test('좌우 이동은 벽에서 멈춘다', () => {
  const g = G.newGame(seeded(3));
  g.piece = G.makePiece('O');
  while (G.move(g, -1));
  assert.equal(g.piece.x, 0);
  assert.equal(G.move(g, -1), false);
  while (G.move(g, 1));
  assert.equal(g.piece.x, G.WIDTH - 2);
});

test('한 칸 내리기: y가 늘고, 소프트 드롭은 1점', () => {
  const g = G.newGame(seeded(3));
  assert.equal(G.step(g), 'moved');
  assert.equal(g.piece.y, 1);
  assert.equal(g.score, 0);
  assert.equal(G.softDrop(g), 'moved');
  assert.equal(g.piece.y, 2);
  assert.equal(g.score, 1);
});

test('하드 드롭: 바닥까지 내려 굳고 칸당 2점, 다음 조각이 나온다', () => {
  const g = G.newGame(seeded(5));
  g.piece = G.makePiece('O');
  const upcoming = g.next;
  const cells = G.hardDrop(g);
  assert.equal(cells, G.HEIGHT - 2);
  assert.equal(g.score, cells * 2);
  assert.equal(g.board[G.HEIGHT - 1][4], 'O');
  assert.equal(g.board[G.HEIGHT - 2][5], 'O');
  assert.equal(g.piece.type, upcoming);
  assert.equal(g.piece.y, 0);
});

test('바닥에서 step 하면 굳는다', () => {
  const g = G.newGame(seeded(5));
  g.piece = G.makePiece('O');
  g.piece.y = G.HEIGHT - 2;
  assert.equal(G.step(g), 'locked');
  assert.equal(g.board[G.HEIGHT - 1][4], 'O');
});

test('고스트 위치는 하드 드롭 착지 위치와 같다', () => {
  const g = G.newGame(seeded(5));
  g.piece = G.makePiece('T');
  g.board[10][4] = 'X';
  const y = G.ghostY(g);
  const p = g.piece;
  assert.equal(G.collides(g.board, p.m, p.x, y), false);
  assert.equal(G.collides(g.board, p.m, p.x, y + 1), true);
});

test('한 줄 지우기: 줄이 사라지고 위 줄이 내려온다, 100점 × 레벨 + 드롭 점수', () => {
  const g = G.newGame(seeded(7));
  fillRowsExceptLastCol(g, 1);
  verticalIAtLastCol(g);
  const cells = G.hardDrop(g);
  assert.equal(g.lines, 1);
  assert.equal(g.score, 100 + cells * 2);
  assert.equal(g.board[G.HEIGHT - 1][9], 'I'); // 위에 있던 I 조각이 한 줄 내려옴
  assert.equal(g.board[G.HEIGHT - 1][0], null);
});

test('네 줄 한 번에 지우기: 800점', () => {
  const g = G.newGame(seeded(7));
  fillRowsExceptLastCol(g, 4);
  verticalIAtLastCol(g);
  const cells = G.hardDrop(g);
  assert.equal(g.lines, 4);
  assert.equal(g.score, 800 + cells * 2);
  assert.ok(g.board.every((row) => row.every((v) => v === null)));
});

test('줄 점수는 지울 때의 레벨을 곱하고, 10줄마다 레벨이 오른다', () => {
  const g = G.newGame(seeded(7));
  g.lines = 9;
  fillRowsExceptLastCol(g, 1);
  verticalIAtLastCol(g);
  const cells = G.hardDrop(g);
  assert.equal(g.lines, 10);
  assert.equal(g.level, 2);
  assert.equal(g.score, 100 + cells * 2); // 지운 순간의 레벨은 1
  fillRowsExceptLastCol(g, 1);
  verticalIAtLastCol(g);
  const before = g.score;
  const cells2 = G.hardDrop(g);
  assert.equal(g.score - before, 200 + cells2 * 2); // 이번에는 레벨 2
});

test('벽 옆에서 회전하면 안쪽으로 밀려서 회전된다', () => {
  const g = G.newGame(seeded(9));
  verticalIAtLastCol(g); // 세로 I 가 맨 오른쪽 열
  assert.equal(G.rotate(g, -1), true);
  assert.equal(g.piece.x, G.WIDTH - 4);
  assert.deepEqual(g.piece.m[1], [1, 1, 1, 1]);
});

test('회전할 자리가 전혀 없으면 회전하지 않는다', () => {
  const g = G.newGame(seeded(9));
  g.piece = G.makePiece('I');
  g.piece.y = 5;
  const before = JSON.stringify(g.piece);
  // 주변을 모두 막는다
  for (let r = 0; r < G.HEIGHT; r++) for (let c = 0; c < G.WIDTH; c++) {
    if (r !== 6) g.board[r][c] = 'X';
  }
  for (let c = 0; c < G.WIDTH; c++) g.board[6][c] = c >= 3 && c <= 6 ? null : 'X';
  assert.equal(G.rotate(g, 1), false);
  assert.equal(JSON.stringify(g.piece), before);
});

test('새 조각이 나올 자리가 막혀 있으면 게임 끝', () => {
  const g = G.newGame(seeded(11));
  g.board[0].fill('X');
  g.board[1].fill('X');
  G.spawn(g);
  assert.equal(g.over, true);
  assert.equal(G.step(g), 'over');
  assert.equal(G.move(g, 1), false);
  assert.equal(G.rotate(g, 1), false);
  assert.equal(G.hardDrop(g), 0);
});

test('같은 자리에 계속 쌓으면 결국 게임이 끝난다', () => {
  const g = G.newGame(seeded(13));
  let guard = 0;
  while (!g.over && guard++ < 200) G.hardDrop(g);
  assert.equal(g.over, true);
  assert.ok(guard < 200);
});

test('낙하 간격: 레벨이 오를수록 짧아지고 100ms 밑으로 내려가지 않는다', () => {
  assert.equal(G.dropInterval(1), 800);
  assert.ok(G.dropInterval(2) < G.dropInterval(1));
  assert.equal(G.dropInterval(50), 100);
});
