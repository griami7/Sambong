'use strict';
// 붙여넣은 데이터가 밖으로 나가거나 저장되지 않도록 index.html 을 정적으로 검사한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readHtml } = require('./load-core');

const html = readHtml();

test('외부 자원 참조가 없다 (src/href/@import/url() 에 http(s)·// 없음)', () => {
  assert.doesNotMatch(html, /\b(?:src|href|action|poster|data)\s*=\s*["']?\s*(?:https?:)?\/\//i);
  assert.doesNotMatch(html, /@import/i);
  assert.doesNotMatch(html, /url\(\s*["']?\s*(?:https?:)?\/\//i);
  assert.doesNotMatch(html, /<(?:link|iframe|img|form|object|embed|audio|video|source)\b/i);
  assert.doesNotMatch(html, /<script[^>]*\bsrc\s*=/i);
});

test('전송·저장·분석 API를 쓰지 않는다', () => {
  const banned = [
    'fetch', 'XMLHttpRequest', 'sendBeacon', 'WebSocket', 'EventSource', 'importScripts',
    'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'caches',
    'serviceWorker', 'navigator.clipboard', 'postMessage', 'window.open', 'eval(', 'new Function',
    'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write',
  ];
  for (const word of banned) {
    assert.ok(!html.includes(word), `금지된 API: ${word}`);
  }
});

test('CSP가 외부 연결·자원·폼 전송을 막는다', () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert.ok(m, 'CSP 메타 태그 없음');
  const csp = m[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.doesNotMatch(csp, /https?:|\*/);
});

test('입력란은 맞춤법 검사·자동완성을 끈다', () => {
  const ta = html.match(/<textarea\b[^>]*>/)[0];
  assert.match(ta, /spellcheck="false"/);
  assert.match(ta, /autocomplete="off"/);
});

test('.nojekyll 이 저장소 맨 위에 있고 비어 있다', () => {
  const p = path.join(__dirname, '..', '.nojekyll');
  assert.ok(fs.existsSync(p));
  assert.equal(fs.statSync(p).size, 0);
});

test('index.html 하나로 동작한다 (화면 로직도 같은 파일 안)', () => {
  assert.equal((html.match(/<script id="tally-core">/g) || []).length, 1);
  assert.match(html, /SurveyTally\.tally\(/);
});
