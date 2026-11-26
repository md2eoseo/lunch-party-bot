// 점심 파티의 핵심 로직 (Slack API와 무관한 순수 함수들 → 테스트하기 쉬움)
const crypto = require('crypto');

const LIMIT_MIN = 2;
const LIMIT_MAX = 50;
const DEFAULT_MIN = 2;
const DEFAULT_MAX = 50;
const PLACE_MAX_LENGTH = 500;

const STATUS = {
  OPEN: 'open',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
};

/** 빈 값이면 기본값, 정수가 아니면 NaN */
function toInt(raw, fallback) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number(raw);
  return Number.isInteger(n) ? n : NaN;
}

/**
 * 입력값 검증.
 * @returns {{ place: string, min: number, max: number, errors: Record<'place'|'min'|'max', string> }}
 */
function validateInput({ place, min, max }) {
  const errors = {};
  const cleanPlace = String(place ?? '').trim();
  const minN = toInt(min, DEFAULT_MIN);
  const maxN = toInt(max, DEFAULT_MAX);
  const inRange = (n) => Number.isInteger(n) && n >= LIMIT_MIN && n <= LIMIT_MAX;

  if (!cleanPlace) errors.place = '점심 장소 또는 메뉴를 입력해주세요.';
  else if (cleanPlace.length > PLACE_MAX_LENGTH) errors.place = `${PLACE_MAX_LENGTH}자 이내로 입력해주세요.`;

  if (!inRange(minN)) errors.min = `${LIMIT_MIN}~${LIMIT_MAX} 사이의 정수를 입력해주세요.`;
  if (!inRange(maxN)) errors.max = `${LIMIT_MIN}~${LIMIT_MAX} 사이의 정수를 입력해주세요.`;
  if (!errors.min && !errors.max && minN > maxN) {
    errors.max = `최대 인원은 최소 인원(${minN}명)보다 크거나 같아야 해요.`;
  }

  return { place: cleanPlace, min: minN, max: maxN, errors };
}

/** 새 파티 생성. 주최자는 자동으로 첫 번째 참여자가 됩니다. */
function createParty({ hostId, place, min, max, channel }) {
  return {
    id: crypto.randomUUID(),
    hostId,
    place,
    min,
    max,
    channel,
    ts: null,
    participants: [hostId],
    status: STATUS.OPEN,
    minNotified: false,
    createdAt: Date.now(),
  };
}

const mentions = (ids) => ids.map((id) => `<@${id}>`).join(' ');

/**
 * 버튼 동작을 파티에 적용합니다 (party 객체를 직접 변경).
 * @param {'join'|'leave'|'confirm'|'cancel'} kind
 * @returns {{ error?: string, ephemeral?: string, thread?: string }}
 *   error     : 실패 사유 (누른 사람에게만 보임, 파티는 변경되지 않음)
 *   ephemeral : 성공 안내 (누른 사람에게만 보임)
 *   thread    : 스레드에 남길 공개 알림
 */
function applyAction(party, kind, userId) {
  if (party.status !== STATUS.OPEN) {
    return { error: '이미 종료된 점심 파티예요.' };
  }

  const isHost = userId === party.hostId;
  const joined = party.participants.includes(userId);

  switch (kind) {
    case 'join': {
      if (joined) return { error: '이미 참여 중이에요. 🙂' };
      if (party.participants.length >= party.max) {
        return { error: `정원(${party.max}명)이 가득 찼어요. 😢` };
      }
      party.participants.push(userId);
      const n = party.participants.length;
      const result = { ephemeral: '참여 완료! 맛있는 점심 되세요. 🍚' };
      const notes = [];
      if (n >= party.min && !party.minNotified) {
        party.minNotified = true;
        notes.push(`✅ 최소 인원(${party.min}명)이 모였어요! ${mentions(party.participants)}`);
      }
      if (n === party.max) {
        notes.push(`🔒 정원(${party.max}명)이 가득 찼어요. <@${party.hostId}>님, [모집 확정]을 눌러주세요.`);
      }
      if (notes.length) result.thread = notes.join('\n');
      return result;
    }

    case 'leave': {
      if (isHost) return { error: '주최자는 나갈 수 없어요. 대신 [모집 취소]를 눌러주세요.' };
      if (!joined) return { error: '아직 참여하지 않았어요.' };
      party.participants = party.participants.filter((id) => id !== userId);
      const result = { ephemeral: '참여를 취소했어요.' };
      if (party.minNotified && party.participants.length < party.min) {
        party.minNotified = false;
        result.thread = `⚠️ <@${userId}>님이 빠져서 최소 인원(${party.min}명)보다 적어졌어요.`;
      }
      return result;
    }

    case 'confirm': {
      if (!isHost) return { error: '모집 확정은 주최자만 할 수 있어요.' };
      const n = party.participants.length;
      if (n < party.min) {
        return { error: `아직 최소 인원(${party.min}명)이 모이지 않았어요. (현재 ${n}명)` };
      }
      party.status = STATUS.CONFIRMED;
      return {
        ephemeral: '모집을 확정했어요.',
        thread: `🎉 점심 파티 확정! ${mentions(party.participants)} 함께 맛있게 드세요!`,
      };
    }

    case 'cancel': {
      if (!isHost) return { error: '모집 취소는 주최자만 할 수 있어요.' };
      party.status = STATUS.CANCELLED;
      const others = party.participants.filter((id) => id !== party.hostId);
      return {
        ephemeral: '모집을 취소했어요.',
        thread: `🚫 주최자가 점심 파티를 취소했어요.${others.length ? ' ' + mentions(others) : ''}`,
      };
    }

    default:
      return { error: '알 수 없는 동작이에요.' };
  }
}

module.exports = {
  LIMIT_MIN,
  LIMIT_MAX,
  DEFAULT_MIN,
  DEFAULT_MAX,
  PLACE_MAX_LENGTH,
  STATUS,
  validateInput,
  createParty,
  applyAction,
};
