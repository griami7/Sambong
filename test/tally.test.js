'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load-core');

const T = loadCore();
const tab = (...rows) => rows.map((r) => r.join('\t')).join('\n');

test('classifyCell: 1~5 는 유효 (앞뒤 공백 무시)', () => {
  for (const v of ['1', '2', '3', '4', '5', ' 3 ', '\t4', '5 ', '　2']) {
    assert.equal(T.classifyCell(v), 'valid', JSON.stringify(v));
  }
});

test('classifyCell: 비었거나 공백뿐이면 빈 응답', () => {
  for (const v of ['', ' ', '   ', '\t', ' ', undefined, null]) {
    assert.equal(T.classifyCell(v), 'blank', JSON.stringify(v));
  }
});

test('classifyCell: 그 밖은 제외', () => {
  for (const v of ['0', '6', '10', '1.0', '01', '-1', '1,2', 'a', '예', '３', '1 2', 'N/A']) {
    assert.equal(T.classifyCell(v), 'excluded', JSON.stringify(v));
  }
});

test('formatAverage: 소수 둘째 자리, 셋째 자리에서 반올림', () => {
  assert.equal(T.formatAverage(0, 0), '-');
  assert.equal(T.formatAverage(3, 1), '3.00');
  assert.equal(T.formatAverage(10, 3), '3.33');
  assert.equal(T.formatAverage(11, 3), '3.67');
  assert.equal(T.formatAverage(21, 8), '2.63'); // 2.625 → 올림
  assert.equal(T.formatAverage(1, 8), '0.13'); // 0.125 → 올림
  assert.equal(T.formatAverage(5, 4), '1.25');
  assert.equal(T.formatAverage(4, 1), '4.00');
  assert.equal(T.formatAverage(1003, 200), '5.02'); // 5.015 → 올림 (부동소수 오차 없음)
  assert.equal(T.formatAverage(1, 1000), '0.00');
});

test('tally: 기본 집계 — 첫 열(응답번호)은 집계하지 않는다', () => {
  const r = T.tally(tab(
    ['번호', 'Q1', 'Q2'],
    ['1', '5', '1'],
    ['2', '4', ''],
    ['3', '3', 'x'],
  ));
  assert.equal(r.ok, true);
  assert.equal(r.responseCount, 3);
  assert.equal(r.questions.length, 2);
  const [q1, q2] = r.questions;
  assert.deepEqual(
    { name: q1.name, valid: q1.valid, average: q1.average, blank: q1.blank, excluded: q1.excluded },
    { name: 'Q1', valid: 3, average: '4.00', blank: 0, excluded: 0 },
  );
  assert.deepEqual(
    { name: q2.name, valid: q2.valid, average: q2.average, blank: q2.blank, excluded: q2.excluded },
    { name: 'Q2', valid: 1, average: '1.00', blank: 1, excluded: 1 },
  );
});

test('tally: 유효 응답이 0이면 평균은 "-"', () => {
  const r = T.tally(tab(['번호', 'Q1'], ['1', ''], ['2', '9']));
  assert.equal(r.questions[0].valid, 0);
  assert.equal(r.questions[0].average, '-');
  assert.equal(r.questions[0].blank, 1);
  assert.equal(r.questions[0].excluded, 1);
});

test('tally: 칸이 모자란 줄은 모자란 칸을 빈 응답으로 센다', () => {
  const r = T.tally('번호\tQ1\tQ2\tQ3\n1\t5\n2\t4\t3\n3');
  const [q1, q2, q3] = r.questions;
  assert.deepEqual([q1.valid, q1.blank], [2, 1]);
  assert.deepEqual([q2.valid, q2.blank], [1, 2]);
  assert.deepEqual([q3.valid, q3.blank], [0, 3]);
  assert.equal(r.responseCount, 3);
});

test('tally: 머리글보다 칸이 많은 줄의 남는 칸은 무시한다', () => {
  const r = T.tally(tab(['번호', 'Q1'], ['1', '5', '1', '2']));
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].valid, 1);
  assert.equal(r.questions[0].average, '5.00');
});

test('tally: 줄바꿈 \\r\\n · \\r · 끝의 빈 줄', () => {
  const crlf = T.tally('번호\tQ1\r\n1\t2\r\n2\t4\r\n');
  assert.equal(crlf.responseCount, 2);
  assert.equal(crlf.questions[0].average, '3.00');
  const cr = T.tally('번호\tQ1\r1\t2\r2\t4');
  assert.equal(cr.responseCount, 2);
  const trailing = T.tally('번호\tQ1\n1\t2\n\n\n');
  assert.equal(trailing.responseCount, 1);
});

test('tally: 데이터 중간의 빈 줄은 모자란 줄로 보아 빈 응답 1', () => {
  const r = T.tally('번호\tQ1\n1\t2\n\n3\t4');
  assert.equal(r.responseCount, 3);
  assert.equal(r.questions[0].blank, 1);
  assert.equal(r.questions[0].valid, 2);
});

test('tally: 칸 끝의 빈 칸(탭만 있는 칸)과 공백 칸', () => {
  const r = T.tally('번호\tQ1\tQ2\n1\t \t3\t\n2\t5\t');
  assert.deepEqual([r.questions[0].valid, r.questions[0].blank], [1, 1]);
  assert.deepEqual([r.questions[1].valid, r.questions[1].blank], [1, 1]);
});

test('tally: 머리글만 있으면 응답 0건, 평균 "-"', () => {
  const r = T.tally('번호\tQ1\tQ2');
  assert.equal(r.ok, true);
  assert.equal(r.responseCount, 0);
  assert.deepEqual(r.questions.map((q) => q.average), ['-', '-']);
});

test('tally: 빈 입력 / 문항 없음', () => {
  assert.equal(T.tally('').ok, false);
  assert.equal(T.tally('   ').ok, false);
  assert.equal(T.tally('').error, 'empty');
  const one = T.tally('번호\n1\n2');
  assert.equal(one.ok, false);
  assert.equal(one.error, 'no-questions');
});

test('tally: 머리글 칸이 비어 있으면 (N열)', () => {
  const r = T.tally('번호\t\tQ2\n1\t3\t4');
  assert.deepEqual(r.questions.map((q) => q.name), ['(2열)', 'Q2']);
});

test('tally: 머리글 문항 이름 앞뒤 공백 제거', () => {
  const r = T.tally('번호\t  만족도 \n1\t3');
  assert.equal(r.questions[0].name, '만족도');
});

test('parseTSV: 따옴표 칸 안의 탭·줄바꿈·"" 처리', () => {
  const rows = T.parseTSV('a\t"b\tc"\t"d\ne"\t"x ""y"" z"\n1\t2\t3\t4');
  assert.deepEqual(rows, [['a', 'b\tc', 'd\ne', 'x "y" z'], ['1', '2', '3', '4']]);
});

test('parseTSV: 칸 중간의 따옴표는 글자 그대로', () => {
  assert.deepEqual(T.parseTSV('a"b\tc'), [['a"b', 'c']]);
});

test('parseTSV: 닫히지 않은 따옴표도 죽지 않는다', () => {
  assert.deepEqual(T.parseTSV('a\t"b\tc'), [['a', '"b\tc']]);
});

test('tally: 따옴표로 감싼 숫자도 유효하게 센다', () => {
  const r = T.tally('번호\tQ1\n1\t"4"\n2\t"5"');
  assert.equal(r.questions[0].valid, 2);
  assert.equal(r.questions[0].average, '4.50');
});

test('tally: 큰 입력 (1만 줄)', () => {
  const lines = ['번호\tQ1\tQ2'];
  for (let i = 1; i <= 10000; i++) lines.push(`${i}\t${(i % 5) + 1}\t${i % 7 === 0 ? '' : 3}`);
  const r = T.tally(lines.join('\n'));
  assert.equal(r.responseCount, 10000);
  assert.equal(r.questions[0].valid, 10000);
  assert.equal(r.questions[0].average, '3.00');
  assert.equal(r.questions[1].blank, 1428);
});
