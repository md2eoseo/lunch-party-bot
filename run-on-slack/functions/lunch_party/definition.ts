import { DefineFunction, Schema } from "deno-slack-sdk/mod.ts";

export const LunchPartyFunction = DefineFunction({
  callback_id: "lunch_party",
  title: "점심 파티 모집",
  description: "입력 창을 열고, 모집 메시지를 올리고, 참여 버튼을 처리합니다",
  source_file: "functions/lunch_party/mod.ts",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel: { type: Schema.slack.types.channel_id },
    },
    required: ["interactivity"],
  },
  output_parameters: { properties: {}, required: [] },
});
