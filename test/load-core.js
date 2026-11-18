'use strict';
// index.html 의 <script id="tally-core"> 만 뽑아 DOM 없이 실행한다.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HTML_PATH = path.join(__dirname, '..', process.env.TALLY_FILE || 'index.html');

function readHtml() {
  return fs.readFileSync(HTML_PATH, 'utf8');
}

function loadCore() {
  const html = readHtml();
  const m = html.match(/<script id="tally-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html 에 tally-core 스크립트가 없습니다');
  const context = vm.createContext({});
  vm.runInContext(m[1], context, { filename: 'index.html#tally-core' });
  const core = context.SurveyTally;
  // vm 안에서 만든 배열·객체는 프로토타입이 달라 deepStrictEqual 이 실패하므로 이쪽 영역으로 복사해 돌려준다.
  const plain = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const wrapped = {};
  for (const name of Object.keys(core)) {
    wrapped[name] = (...args) => plain(core[name](...args));
  }
  return wrapped;
}

module.exports = { loadCore, readHtml };
