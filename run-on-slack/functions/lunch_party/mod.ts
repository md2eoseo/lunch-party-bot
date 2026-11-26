import { SlackFunction } from "deno-slack-sdk/mod.ts";
import { LunchPartyFunction } from "./definition.ts";
import PartyDatastore, { DATASTORE_NAME } from "../../datastores/parties.ts";
import {
  type ActionKind,
  applyAction,
  createParty,
  type Party,
  STATUS,
  validateInput,
} from "./party.ts";
import {
  ACTION,
  BLOCK,
  buildCreateModal,
  buildPartyMessage,
  MODAL_CALLBACK_ID,
  readModalValues,
} from "./blocks.ts";

const ACTION_KIND = Object.fromEntries(
  Object.entries(ACTION).map(([kind, id]) => [id, kind as ActionKind]),
);

const channelErrorMessage = (code?: string) =>
  ({
    not_in_channel:
      "봇이 이 채널에 없어요. 비공개 채널이라면 채널에서 `/invite @점심 파티`로 앱을 초대해주세요.",
    channel_not_found:
      "봇이 이 채널에 접근할 수 없어요. 비공개 채널이라면 앱을 먼저 초대해주세요.",
    is_archived: "보관된 채널에는 모집할 수 없어요.",
  } as Record<string, string>)[code ?? ""] ??
    `메시지를 올리지 못했어요. (${code ?? "알 수 없는 오류"})`;

/**
 * 하나의 점심 파티 = 하나의 함수 실행.
 * 모달 → 모집 메시지 → 버튼 처리가 모두 이 실행 안에서 이뤄지고,
 * [모집 확정]/[모집 취소] 시점에 실행이 완료됩니다.
 */
export default SlackFunction(
  LunchPartyFunction,
  async ({ inputs, client }) => {
    const res = await client.views.open({
      interactivity_pointer: inputs.interactivity.interactivity_pointer,
      view: buildCreateModal(inputs.channel),
    });
    if (!res.ok) return { error: `입력 창을 열지 못했어요: ${res.error}` };
    // completed: false → 버튼이 계속 동작하도록 실행을 열어둡니다.
    return { completed: false };
  },
)
  // 1) 모달 제출 → 검증 → 모집 메시지 게시 → 저장
  .addViewSubmissionHandler(
    MODAL_CALLBACK_ID,
    async ({ view, body, client }) => {
      const raw = readModalValues(view.state.values);
      const { place, min, max, errors } = validateInput(raw);
      const slackErrors: Record<string, string> = {};
      for (const [field, msg] of Object.entries(errors)) {
        slackErrors[BLOCK[field as keyof typeof BLOCK]] = msg as string;
      }
      if (!raw.channel) {
        slackErrors[BLOCK.channel] = "모집할 채널을 선택해주세요.";
      }
      if (Object.keys(slackErrors).length) {
        return { response_action: "errors", errors: slackErrors };
      }

      const channel = raw.channel!;
      const party = createParty({
        hostId: body.user.id,
        place,
        min,
        max,
        channel,
        executionId: body.function_data.execution_id,
      });

      // 공개 채널이면 봇이 먼저 들어가 둡니다 (나만 보이는 안내 메시지에 필요)
      if (channel.startsWith("C")) await client.conversations.join({ channel });

      const msg = await client.chat.postMessage({
        channel,
        ...buildPartyMessage(party),
      });
      if (!msg.ok) {
        return {
          response_action: "errors",
          errors: { [BLOCK.channel]: channelErrorMessage(msg.error) },
        };
      }
      party.channel = msg.channel;
      party.ts = msg.ts;

      const saved = await client.apps.datastore.put<
        typeof PartyDatastore.definition
      >({ datastore: DATASTORE_NAME, item: party });
      if (!saved.ok) {
        await client.chat.delete({ channel: party.channel, ts: party.ts });
        return {
          response_action: "errors",
          errors: { [BLOCK.place]: `저장에 실패했어요. (${saved.error})` },
        };
      }
      // 아무것도 반환하지 않으면 모달이 닫힙니다.
    },
  )
  // 2) 모달을 그냥 닫으면 실행 종료
  .addViewClosedHandler(MODAL_CALLBACK_ID, async ({ body, client }) => {
    await client.functions.completeSuccess({
      function_execution_id: body.function_data.execution_id,
      outputs: {},
    });
  })
  // 3) 참여 / 참여 취소 / 모집 확정 / 모집 취소 버튼
  .addBlockActionsHandler(
    Object.values(ACTION),
    async ({ action, body, client }) => {
      const userId: string = body.user.id;
      const channel: string = body.container?.channel_id ?? body.channel?.id;
      const reply = (text: string) =>
        client.chat.postEphemeral({ channel, user: userId, text });

      const got = await client.apps.datastore.get<
        typeof PartyDatastore.definition
      >({ datastore: DATASTORE_NAME, id: action.value });
      if (!got.ok || !got.item?.id) {
        await reply("이 점심 파티 정보를 찾을 수 없어요.");
        return;
      }

      const party = got.item as Party;
      const result = applyAction(party, ACTION_KIND[action.action_id], userId);
      if (result.error) {
        await reply(result.error);
        return;
      }

      const saved = await client.apps.datastore.put<
        typeof PartyDatastore.definition
      >({ datastore: DATASTORE_NAME, item: party });
      if (!saved.ok) {
        await reply("처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
        return;
      }

      await client.chat.update({
        channel: party.channel,
        ts: party.ts,
        ...buildPartyMessage(party),
      });
      if (result.thread) {
        await client.chat.postMessage({
          channel: party.channel,
          thread_ts: party.ts,
          text: result.thread,
        });
      }
      if (result.ephemeral) await reply(result.ephemeral);

      if (party.status !== STATUS.OPEN) {
        await client.functions.completeSuccess({
          function_execution_id: party.execution_id,
          outputs: {},
        });
      }
    },
  );
