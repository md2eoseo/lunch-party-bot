// 점심 파티 핵심 로직 (Slack API와 무관한 순수 함수 — 테스트하기 쉬움)
// 필드 이름은 datastores/parties.ts 의 속성 이름과 동일합니다.

export const LIMIT_MIN = 2;
export const LIMIT_MAX = 50;
export const DEFAULT_MIN = 2;
export const DEFAULT_MAX = 50;
export const PLACE_MAX_LENGTH = 500;

export const STATUS = {
  OPEN: "open",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
} as const;

export type PartyStatus = typeof STATUS[keyof typeof STATUS];
export type ActionKind = "join" | "leave" | "confirm" | "cancel";

export interface Party {
  id: string;
  host_id: string;
  place: string;
  min: number;
  max: number;
  channel: string;
  ts: string;
  participants: string[];
  status: PartyStatus;
  min_notified: boolean;
  execution_id: string;
  created_at: number;
}

export interface ActionResult {
  /** 실패 사유 (누른 사람에게만 보임, 파티는 바뀌지 않음) */
  error?: string;
  /** 성공 안내 (누른 사람에게만 보임) */
  ephemeral?: string;
  /** 모집 메시지 스레드에 남길 공개 알림 */
  thread?: string;
}

type Field = "place" | "min" | "max";

function toInt(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return fallback;
  }
  const n = Number(raw);
  return Number.isInteger(n) ? n : NaN;
}

export function validateInput(
  input: { place?: unknown; min?: unknown; max?: unknown },
) {
  const errors: Partial<Record<Field, string>> = {};
  const place = String(input.place ?? "").trim();
  const min = toInt(input.min, DEFAULT_MIN);
  const max = toInt(input.max, DEFAULT_MAX);
  const inRange = (n: number) =>
    Number.isInteger(n) && n >= LIMIT_MIN && n <= LIMIT_MAX;

  if (!place) errors.place = "점심 장소 또는 메뉴를 입력해주세요.";
  else if (place.length > PLACE_MAX_LENGTH) {
    errors.place = `${PLACE_MAX_LENGTH}자 이내로 입력해주세요.`;
  }
  if (!inRange(min)) {
    errors.min = `${LIMIT_MIN}~${LIMIT_MAX} 사이의 정수를 입력해주세요.`;
  }
  if (!inRange(max)) {
    errors.max = `${LIMIT_MIN}~${LIMIT_MAX} 사이의 정수를 입력해주세요.`;
  }
  if (!errors.min && !errors.max && min > max) {
    errors.max = `최대 인원은 최소 인원(${min}명)보다 크거나 같아야 해요.`;
  }
  return { place, min, max, errors };
}

/** 새 파티. 주최자는 자동으로 첫 번째 참여자가 됩니다. */
export function createParty(
  p: {
    hostId: string;
    place: string;
    min: number;
    max: number;
    channel: string;
    executionId: string;
  },
): Party {
  return {
    id: crypto.randomUUID(),
    host_id: p.hostId,
    place: p.place,
    min: p.min,
    max: p.max,
    channel: p.channel,
    ts: "",
    participants: [p.hostId],
    status: STATUS.OPEN,
    min_notified: false,
    execution_id: p.executionId,
    created_at: Date.now(),
  };
}

const mentions = (ids: string[]) => ids.map((id) => `<@${id}>`).join(" ");

/** 버튼 동작을 파티에 적용 (party 객체를 직접 변경) */
export function applyAction(
  party: Party,
  kind: ActionKind,
  userId: string,
): ActionResult {
  if (party.status !== STATUS.OPEN) {
    return { error: "이미 종료된 점심 파티예요." };
  }
  const isHost = userId === party.host_id;
  const joined = party.participants.includes(userId);

  switch (kind) {
    case "join": {
      if (joined) return { error: "이미 참여 중이에요. 🙂" };
      if (party.participants.length >= party.max) {
        return { error: `정원(${party.max}명)이 가득 찼어요. 😢` };
      }
      party.participants.push(userId);
      const n = party.participants.length;
      const notes: string[] = [];
      if (n >= party.min && !party.min_notified) {
        party.min_notified = true;
        notes.push(
          `✅ 최소 인원(${party.min}명)이 모였어요! ${
            mentions(party.participants)
          }`,
        );
      }
      if (n === party.max) {
        notes.push(
          `🔒 정원(${party.max}명)이 가득 찼어요. <@${party.host_id}>님, [모집 확정]을 눌러주세요.`,
        );
      }
      return {
        ephemeral: "참여 완료! 맛있는 점심 되세요. 🍚",
        ...(notes.length ? { thread: notes.join("\n") } : {}),
      };
    }

    case "leave": {
      if (isHost) {
        return {
          error: "주최자는 나갈 수 없어요. 대신 [모집 취소]를 눌러주세요.",
        };
      }
      if (!joined) return { error: "아직 참여하지 않았어요." };
      party.participants = party.participants.filter((id) => id !== userId);
      const result: ActionResult = { ephemeral: "참여를 취소했어요." };
      if (party.min_notified && party.participants.length < party.min) {
        party.min_notified = false;
        result.thread =
          `⚠️ <@${userId}>님이 빠져서 최소 인원(${party.min}명)보다 적어졌어요.`;
      }
      return result;
    }

    case "confirm": {
      if (!isHost) return { error: "모집 확정은 주최자만 할 수 있어요." };
      const n = party.participants.length;
      if (n < party.min) {
        return {
          error:
            `아직 최소 인원(${party.min}명)이 모이지 않았어요. (현재 ${n}명)`,
        };
      }
      party.status = STATUS.CONFIRMED;
      return {
        ephemeral: "모집을 확정했어요.",
        thread: `🎉 점심 파티 확정! ${
          mentions(party.participants)
        } 함께 맛있게 드세요!`,
      };
    }

    case "cancel": {
      if (!isHost) return { error: "모집 취소는 주최자만 할 수 있어요." };
      party.status = STATUS.CANCELLED;
      const others = party.participants.filter((id) => id !== party.host_id);
      return {
        ephemeral: "모집을 취소했어요.",
        thread: `🚫 주최자가 점심 파티를 취소했어요.${
          others.length ? " " + mentions(others) : ""
        }`,
      };
    }

    default:
      return { error: "알 수 없는 동작이에요." };
  }
}
