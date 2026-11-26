import { assert, assertEquals, assertMatch } from "@std/assert";
import { applyAction, createParty, STATUS, validateInput } from "./party.ts";
import { buildCreateModal, buildPartyMessage, escapeMrkdwn } from "./blocks.ts";

const newParty = (min: number, max: number) =>
  createParty({
    hostId: "H",
    place: "국밥",
    min,
    max,
    channel: "C1",
    executionId: "Fx1",
  });

Deno.test("기본값: 최소 2명, 최대 50명", () => {
  const r = validateInput({ place: "김치찌개", min: "", max: undefined });
  assertEquals([r.min, r.max, r.errors], [2, 50, {}]);
});

Deno.test("범위 밖 / 소수 / 최소>최대 / 빈 장소는 오류", () => {
  assert(validateInput({ place: "a", min: "1" }).errors.min);
  assert(validateInput({ place: "a", max: "51" }).errors.max);
  assert(validateInput({ place: "a", min: "2.5" }).errors.min);
  assert(validateInput({ place: "a", min: "10", max: "5" }).errors.max);
  assert(validateInput({ place: "   " }).errors.place);
  assertEquals(validateInput({ place: "a", min: "50", max: "50" }).errors, {});
});

Deno.test("참여/정원/나가기/확정 흐름", () => {
  const p = newParty(3, 3);
  assertEquals(p.participants, ["H"]);
  assert(applyAction(p, "join", "H").error);
  assert(applyAction(p, "confirm", "H").error);
  applyAction(p, "join", "A");
  const r = applyAction(p, "join", "B");
  assertMatch(r.thread!, /최소 인원/);
  assertMatch(r.thread!, /정원/);
  assert(applyAction(p, "join", "C").error);
  assert(applyAction(p, "leave", "H").error);
  assertMatch(applyAction(p, "leave", "B").thread!, /적어졌어요/);
  assert(applyAction(p, "confirm", "A").error);
  applyAction(p, "join", "C");
  assert(applyAction(p, "confirm", "H").thread);
  assertEquals(p.status, STATUS.CONFIRMED);
  assert(applyAction(p, "join", "D").error);
});

Deno.test("주최자 취소 시 버튼 제거", () => {
  const p = newParty(2, 50);
  applyAction(p, "join", "A");
  assertMatch(applyAction(p, "cancel", "H").thread!, /<@A>/);
  assert(!buildPartyMessage(p).blocks.some((b) => b.type === "actions"));
});

Deno.test("UI: 모달 기본값, 멘션 주입 방지", () => {
  const modal = buildCreateModal("C1");
  const el = (id: string) =>
    modal.blocks.find((b) => b.block_id === id)!.element as Record<
      string,
      unknown
    >;
  assertEquals(
    [el("min").initial_value, el("max").initial_value],
    ["2", "50"],
  );
  assertEquals(el("channel").initial_conversation, "C1");
  assertEquals(escapeMrkdwn("<!channel> & co"), "&lt;!channel&gt; &amp; co");
});
