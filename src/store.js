// 파티 상태 저장소: 메모리 + JSON 파일 (봇을 재시작해도 진행 중인 파티 유지)
const fs = require('fs');
const path = require('path');

const FILE = process.env.DATA_FILE || path.join(__dirname, '..', 'data', 'parties.json');
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000; // 7일 지난 파티는 정리

let parties = {};

function load() {
  try {
    parties = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('[store] 데이터 파일을 읽지 못했어요:', err.message);
    parties = {};
  }
  const cutoff = Date.now() - RETENTION_MS;
  for (const [id, p] of Object.entries(parties)) {
    if (p.createdAt < cutoff) delete parties[id];
  }
  save();
}

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(parties, null, 2));
  fs.renameSync(tmp, FILE); // 원자적 교체로 파일 손상 방지
}

const get = (id) => parties[id];

function put(party) {
  parties[party.id] = party;
  save();
}

module.exports = { load, get, put };
