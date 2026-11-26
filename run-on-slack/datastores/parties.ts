import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

export const DATASTORE_NAME = "lunch_parties";

/** 점심 파티 상태 (Slack이 호스팅하는 저장소) */
const PartyDatastore = DefineDatastore({
  name: DATASTORE_NAME,
  primary_key: "id",
  attributes: {
    id: { type: Schema.types.string },
    host_id: { type: Schema.slack.types.user_id },
    place: { type: Schema.types.string },
    min: { type: Schema.types.integer },
    max: { type: Schema.types.integer },
    channel: { type: Schema.slack.types.channel_id },
    ts: { type: Schema.types.string },
    participants: {
      type: Schema.types.array,
      items: { type: Schema.slack.types.user_id },
    },
    status: { type: Schema.types.string },
    min_notified: { type: Schema.types.boolean },
    execution_id: { type: Schema.types.string },
    created_at: { type: Schema.types.number },
  },
});

export default PartyDatastore;
