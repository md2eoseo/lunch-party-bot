const test = require('node:test');
const assert = require('node:assert');
const { validateInput, createParty, applyAction, STATUS } = require('../src/party');
const { buildCreateModal, buildPartyMessage, readModalValues, escapeMrkdwn } = require('../src/views');

test('기본값: 최소 2명, 최대 50명', () => {
  const r = validateInput({ place: '김치찌개', min: '', max: undefined });
  assert.deepStrictEqual([r.min, r.max, r.errors], [2, 50, {}]);
});

test('범위 밖 / 소수 / 최소>최대 / 빈 장소는 오류', () => {
  assert.ok(validateInput({ place: 'a', min: '1' }).errors.min);
  assert.ok(validateInput({ place: 'a', max: '51' }).errors.max);
  assert.ok(validateInput({ place: 'a', min: '2.5' }).errors.min);
  assert.ok(validateInput({ place: 'a', min: '10', max: '5' }).errors.max);
  assert.ok(validateInput({ place: '   ' }).errors.place);
  assert.deepStrictEqual(validateInput({ place: 'a', min: '50', max: '50' }).errors, {});
});

test('참여/정원/취소/확정 흐름', () => {
  const p = createParty({ hostId: 'H', place: '국밥', min: 3, max: 3, channel: 'C1' });
  assert.deepStrictEqual(p.participants, ['H']);

  assert.ok(applyAction(p, 'join', 'H').error, '주최자 중복 참여 불가');
  assert.ok(applyAction(p, 'confirm', 'H').error, '최소 인원 미달 시 확정 불가');
  assert.ok(!applyAction(p, 'join', 'A').thread);
  const r = applyAction(p, 'join', 'B');
  assert.match(r.thread, /최소 인원/);
  assert.match(r.thread, /정원/);
  assert.ok(applyAction(p, 'join', 'C').error, '정원 초과 불가');

  assert.ok(applyAction(p, 'leave', 'H').error, '주최자 나가기 불가');
  assert.match(applyAction(p, 'leave', 'B').thread, /적어졌어요/);
  assert.ok(applyAction(p, 'confirm', 'A').error, '참여자는 확정 불가');
  applyAction(p, 'join', 'C');
  assert.ok(applyAction(p, 'confirm', 'H').thread);
  assert.strictEqual(p.status, STATUS.CONFIRMED);
  assert.ok(applyAction(p, 'join', 'D').error, '종료 후 참여 불가');
});

test('주최자 취소', () => {
  const p = createParty({ hostId: 'H', place: 'x', min: 2, max: 50, channel: 'C1' });
  applyAction(p, 'join', 'A');
  assert.match(applyAction(p, 'cancel', 'H').thread, /<@A>/);
  assert.strictEqual(p.status, STATUS.CANCELLED);
  assert.ok(!buildPartyMessage(p).blocks.some((b) => b.type === 'actions'), '종료되면 버튼 제거');
});

test('UI: 모달 기본값과 멘션 주입 방지', () => {
  const modal = buildCreateModal({ place: 'https://naver.me/abc' });
  const min = modal.blocks.find((b) => b.block_id === 'min').element;
  const max = modal.blocks.find((b) => b.block_id === 'max').element;
  assert.deepStrictEqual([min.initial_value, max.initial_value, min.min_value, max.max_value], ['2', '50', '2', '50']);
  assert.strictEqual(escapeMrkdwn('<!channel> & co'), '&lt;!channel&gt; &amp; co');
  const values = { place: { value: { value: 'x' } }, channel: { value: { selected_conversation: 'C9' } } };
  assert.deepStrictEqual(readModalValues(values), { place: 'x', min: undefined, max: undefined, channel: 'C9' });
  assert.ok(JSON.stringify(modal).length < 3000);
});
