import type { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import LunchPartyWorkflow from "../workflows/lunch_party.ts";

/**
 * 링크 트리거: 생성하면 https://slack.com/shortcuts/... 링크가 발급됩니다.
 * 채널 책갈피(북마크)에 추가하거나 메시지로 공유해서 사용하세요.
 */
const lunchLinkTrigger: Trigger<typeof LunchPartyWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "🍱 점심 파티 모집",
  description: "같이 점심 먹을 사람을 모집해요",
  workflow: `#/workflows/${LunchPartyWorkflow.definition.callback_id}`,
  inputs: {
    interactivity: { value: TriggerContextData.Shortcut.interactivity },
    channel: { value: TriggerContextData.Shortcut.channel_id },
  },
};

export default lunchLinkTrigger;
