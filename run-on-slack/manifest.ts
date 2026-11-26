import { Manifest } from "deno-slack-sdk/mod.ts";
import LunchPartyWorkflow from "./workflows/lunch_party.ts";
import PartyDatastore from "./datastores/parties.ts";

export default Manifest({
  name: "점심 파티",
  description: "같이 점심 먹을 사람을 모집해요 🍱",
  icon: "assets/icon.png",
  workflows: [LunchPartyWorkflow],
  datastores: [PartyDatastore],
  outgoingDomains: [],
  botScopes: [
    "chat:write",
    "chat:write.public",
    "channels:join",
    "datastore:read",
    "datastore:write",
  ],
});
