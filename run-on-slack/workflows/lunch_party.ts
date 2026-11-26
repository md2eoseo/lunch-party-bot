import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { LunchPartyFunction } from "../functions/lunch_party/definition.ts";

const LunchPartyWorkflow = DefineWorkflow({
  callback_id: "lunch_party_workflow",
  title: "점심 파티 모집",
  description: "같이 점심 먹을 사람을 모집해요",
  input_parameters: {
    properties: {
      interactivity: { type: Schema.slack.types.interactivity },
      channel: { type: Schema.slack.types.channel_id },
    },
    required: ["interactivity"],
  },
});

LunchPartyWorkflow.addStep(LunchPartyFunction, {
  interactivity: LunchPartyWorkflow.inputs.interactivity,
  channel: LunchPartyWorkflow.inputs.channel,
});

export default LunchPartyWorkflow;
