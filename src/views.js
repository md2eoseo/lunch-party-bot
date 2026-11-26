// Slack Block Kit UI (모달 + 모집 메시지)
const {
  LIMIT_MIN, LIMIT_MAX, DEFAULT_MIN, DEFAULT_MAX, PLACE_MAX_LENGTH, STATUS,
} = require('./party');

const MODAL_CALLBACK_ID = 'lunch_party_create';
const BLOCK = { place: 'place', min: 'min', max: 'max', channel: 'channel' };
const ACTION = { join: 'lunch_join', leave: 'lunch_leave', confirm: 'lunch_confirm', cancel: 'lunch_cancel' };

const pt = (text) => ({ type: 'plain_text', text, emoji: true });

/** Slack mrkdwn 특수문자 이스케이프 (<!channel> 같은 멘션 주입 방지) */
function escapeMrkdwn(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 슬래시 커맨드 텍스트는 Slack이 이스케이프해서 보내므로 되돌림 */
function unescapeSlack(text) {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

function buildCreateModal({ place = '' } = {}) {
  const placeElement = {
    type: 'plain_text_input',
    action_id: 'value',
    multiline: true,
    max_length: PLACE_MAX_LENGTH,
    placeholder: pt('예) 을지로 김치찌개 / 오늘은 국밥! / https://naver.me/xxxx'),
  };
  const initial = place.trim().slice(0, PLACE_MAX_LENGTH);
  if (initial) placeElement.initial_value = initial;

  const numberElement = (initial) => ({
    type: 'number_input',
    action_id: 'value',
    is_decimal_allowed: false,
    min_value: String(LIMIT_MIN),
    max_value: String(LIMIT_MAX),
    initial_value: String(initial),
  });

  return {
    type: 'modal',
    callback_id: MODAL_CALLBACK_ID,
    title: pt('점심 파티 만들기'),
    submit: pt('모집 시작'),
    close: pt('닫기'),
    blocks: [
      {
        type: 'input',
        block_id: BLOCK.place,
        label: pt('🍽️ 점심 장소 또는 메뉴'),
        hint: pt('식당 이름, 메뉴 이름, 지도 앱 URL 등 자유롭게 적어주세요.'),
        element: placeElement,
      },
      {
        type: 'input',
        block_id: BLOCK.min,
        optional: true,
        label: pt('최소 인원'),
        hint: pt(`${LIMIT_MIN}~${LIMIT_MAX}명 · 비우면 ${DEFAULT_MIN}명 · 주최자 포함`),
        element: numberElement(DEFAULT_MIN),
      },
      {
        type: 'input',
        block_id: BLOCK.max,
        optional: true,
        label: pt('최대 인원'),
        hint: pt(`${LIMIT_MIN}~${LIMIT_MAX}명 · 비우면 ${DEFAULT_MAX}명 · 주최자 포함`),
        element: numberElement(DEFAULT_MAX),
      },
      {
        type: 'input',
        block_id: BLOCK.channel,
        label: pt('모집할 채널'),
        element: {
          type: 'conversations_select',
          action_id: 'value',
          default_to_current_conversation: true,
          filter: { include: ['public', 'private'], exclude_bot_users: true },
        },
      },
    ],
  };
}

/** 모달 제출값 → 원시 입력값 */
function readModalValues(values) {
  const v = (block) => values?.[block]?.value;
  return {
    place: v(BLOCK.place)?.value,
    min: v(BLOCK.min)?.value,
    max: v(BLOCK.max)?.value,
    channel: v(BLOCK.channel)?.selected_conversation,
  };
}

function statusLine(party) {
  const n = party.participants.length;
  if (party.status === STATUS.CONFIRMED) return '🎉 *모집 확정* — 맛있게 드세요!';
  if (party.status === STATUS.CANCELLED) return '🚫 *모집 취소됨*';
  if (n >= party.max) return '🔒 *정원 마감* — 주최자가 확정하면 완료돼요.';
  if (n >= party.min) return `✅ *출발 가능!* 최소 인원 달성 · ${party.max - n}명 더 참여할 수 있어요.`;
  return `⏳ *모집 중* — 최소 인원까지 ${party.min - n}명 더 필요해요.`;
}

/** 채널에 올라가는 모집 메시지 (chat.postMessage / chat.update 용) */
function buildPartyMessage(party) {
  const n = party.participants.length;
  const open = party.status === STATUS.OPEN;
  const place = escapeMrkdwn(party.place);

  const blocks = [
    { type: 'header', text: pt(open ? '🍱 점심 파티 모집' : '🍱 점심 파티') },
    { type: 'section', text: { type: 'mrkdwn', text: `*장소 / 메뉴*\n${place}` } },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*주최*\n<@${party.hostId}>` },
        { type: 'mrkdwn', text: `*인원*\n${n}명 참여 (최소 ${party.min} · 최대 ${party.max})` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*참여자*\n${party.participants.map((id) => `<@${id}>`).join(', ')}` },
    },
    { type: 'context', elements: [{ type: 'mrkdwn', text: statusLine(party) }] },
  ];

  if (open) {
    const full = n >= party.max;
    blocks.push({
      type: 'actions',
      block_id: 'party_actions',
      elements: [
        {
          type: 'button',
          action_id: ACTION.join,
          text: pt(full ? '🔒 정원 마감' : '🙋 참여하기'),
          ...(full ? {} : { style: 'primary' }),
          value: party.id,
        },
        { type: 'button', action_id: ACTION.leave, text: pt('참여 취소'), value: party.id },
        { type: 'button', action_id: ACTION.confirm, text: pt('✅ 모집 확정 (주최자)'), value: party.id },
        {
          type: 'button',
          action_id: ACTION.cancel,
          text: pt('모집 취소 (주최자)'),
          style: 'danger',
          value: party.id,
          confirm: {
            title: pt('모집을 취소할까요?'),
            text: pt('참여자들에게 취소 알림이 전송돼요.'),
            confirm: pt('취소하기'),
            deny: pt('돌아가기'),
          },
        },
      ],
    });
  }

  const fallback = `🍱 점심 파티: ${party.place} (${n}/${party.max}명)`;
  return { text: fallback, blocks };
}

module.exports = {
  MODAL_CALLBACK_ID,
  BLOCK,
  ACTION,
  escapeMrkdwn,
  unescapeSlack,
  buildCreateModal,
  readModalValues,
  buildPartyMessage,
};
