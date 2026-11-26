// Block Kit UI (입력 모달 + 모집 메시지)
import {
  type ActionKind,
  DEFAULT_MAX,
  DEFAULT_MIN,
  LIMIT_MAX,
  LIMIT_MIN,
  type Party,
  PLACE_MAX_LENGTH,
  STATUS,
} from "./party.ts";

export const MODAL_CALLBACK_ID = "lunch_party_create";
export const BLOCK = {
  place: "place",
  min: "min",
  max: "max",
  channel: "channel",
} as const;
export const ACTION: Record<ActionKind, string> = {
  join: "lunch_join",
  leave: "lunch_leave",
  confirm: "lunch_confirm",
  cancel: "lunch_cancel",
};

const pt = (text: string) => ({ type: "plain_text", text, emoji: true });

/** Slack mrkdwn 특수문자 이스케이프 (<!channel> 같은 멘션 주입 방지) */
export function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
    />/g,
    "&gt;",
  );
}

export function buildCreateModal(defaultChannel?: string) {
  const numberElement = (initial: number) => ({
    type: "number_input",
    action_id: "value",
    is_decimal_allowed: false,
    min_value: String(LIMIT_MIN),
    max_value: String(LIMIT_MAX),
    initial_value: String(initial),
  });

  return {
    type: "modal",
    callback_id: MODAL_CALLBACK_ID,
    title: pt("점심 파티 만들기"),
    submit: pt("모집 시작"),
    close: pt("닫기"),
    notify_on_close: true,
    blocks: [
      {
        type: "input",
        block_id: BLOCK.place,
        label: pt("🍽️ 점심 장소 또는 메뉴"),
        hint: pt("식당 이름, 메뉴 이름, 지도 앱 URL 등 자유롭게 적어주세요."),
        element: {
          type: "plain_text_input",
          action_id: "value",
          multiline: true,
          max_length: PLACE_MAX_LENGTH,
          placeholder: pt(
            "예) 을지로 김치찌개 / 오늘은 국밥! / https://naver.me/xxxx",
          ),
        },
      },
      {
        type: "input",
        block_id: BLOCK.min,
        optional: true,
        label: pt("최소 인원"),
        hint: pt(
          `${LIMIT_MIN}~${LIMIT_MAX}명 · 비우면 ${DEFAULT_MIN}명 · 주최자 포함`,
        ),
        element: numberElement(DEFAULT_MIN),
      },
      {
        type: "input",
        block_id: BLOCK.max,
        optional: true,
        label: pt("최대 인원"),
        hint: pt(
          `${LIMIT_MIN}~${LIMIT_MAX}명 · 비우면 ${DEFAULT_MAX}명 · 주최자 포함`,
        ),
        element: numberElement(DEFAULT_MAX),
      },
      {
        type: "input",
        block_id: BLOCK.channel,
        label: pt("모집할 채널"),
        element: {
          type: "conversations_select",
          action_id: "value",
          ...(defaultChannel
            ? { initial_conversation: defaultChannel }
            : { default_to_current_conversation: true }),
          filter: { include: ["public", "private"], exclude_bot_users: true },
        },
      },
    ],
  };
}

// deno-lint-ignore no-explicit-any
export function readModalValues(values: any) {
  const v = (block: string) => values?.[block]?.value;
  return {
    place: v(BLOCK.place)?.value as string | undefined,
    min: v(BLOCK.min)?.value as string | undefined,
    max: v(BLOCK.max)?.value as string | undefined,
    channel: v(BLOCK.channel)?.selected_conversation as string | undefined,
  };
}

function statusLine(party: Party): string {
  const n = party.participants.length;
  if (party.status === STATUS.CONFIRMED) {
    return "🎉 *모집 확정* — 맛있게 드세요!";
  }
  if (party.status === STATUS.CANCELLED) return "🚫 *모집 취소됨*";
  if (n >= party.max) return "🔒 *정원 마감* — 주최자가 확정하면 완료돼요.";
  if (n >= party.min) {
    return `✅ *출발 가능!* 최소 인원 달성 · ${
      party.max - n
    }명 더 참여할 수 있어요.`;
  }
  return `⏳ *모집 중* — 최소 인원까지 ${party.min - n}명 더 필요해요.`;
}

/** 채널에 올라가는 모집 메시지 */
export function buildPartyMessage(party: Party) {
  const n = party.participants.length;
  const open = party.status === STATUS.OPEN;
  const full = n >= party.max;

  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [
    { type: "header", text: pt(open ? "🍱 점심 파티 모집" : "🍱 점심 파티") },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*장소 / 메뉴*\n${escapeMrkdwn(party.place)}`,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*주최*\n<@${party.host_id}>` },
        {
          type: "mrkdwn",
          text: `*인원*\n${n}명 참여 (최소 ${party.min} · 최대 ${party.max})`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*참여자*\n${
          party.participants.map((id) => `<@${id}>`).join(", ")
        }`,
      },
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: statusLine(party) }],
    },
  ];

  if (open) {
    blocks.push({
      type: "actions",
      block_id: "party_actions",
      elements: [
        {
          type: "button",
          action_id: ACTION.join,
          text: pt(full ? "🔒 정원 마감" : "🙋 참여하기"),
          ...(full ? {} : { style: "primary" }),
          value: party.id,
        },
        {
          type: "button",
          action_id: ACTION.leave,
          text: pt("참여 취소"),
          value: party.id,
        },
        {
          type: "button",
          action_id: ACTION.confirm,
          text: pt("✅ 모집 확정 (주최자)"),
          value: party.id,
        },
        {
          type: "button",
          action_id: ACTION.cancel,
          text: pt("모집 취소 (주최자)"),
          style: "danger",
          value: party.id,
          confirm: {
            title: pt("모집을 취소할까요?"),
            text: pt("참여자들에게 취소 알림이 전송돼요."),
            confirm: pt("취소하기"),
            deny: pt("돌아가기"),
          },
        },
      ],
    });
  }

  return {
    text: `🍱 점심 파티: ${party.place} (${n}/${party.max}명)`,
    blocks,
  };
}
