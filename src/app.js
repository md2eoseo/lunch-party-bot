require('dotenv').config();
const { App, LogLevel } = require('@slack/bolt');

const store = require('./store');
const { validateInput, createParty, applyAction } = require('./party');
const {
  MODAL_CALLBACK_ID, BLOCK, ACTION, unescapeSlack, buildCreateModal, readModalValues, buildPartyMessage,
} = require('./views');

for (const key of ['SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN']) {
  if (!process.env[key]) {
    console.error(`환경변수 ${key} 가 없어요. .env 파일을 확인해주세요.`);
    process.exit(1);
  }
}

const COMMAND = process.env.SLASH_COMMAND || '/lunch';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true, // 공개 URL/서버 없이 WebSocket으로 연결
  logLevel: process.env.LOG_LEVEL || LogLevel.INFO,
});

store.load();

// 1) /lunch [장소] → 파티 생성 모달 열기
app.command(COMMAND, async ({ ack, command, client }) => {
  await ack();
  await client.views.open({
    trigger_id: command.trigger_id,
    view: buildCreateModal({ place: unescapeSlack(command.text || '') }),
  });
});

// 2) 전역 바로가기(⚡ 메뉴) → 같은 모달
app.shortcut('create_lunch_party', async ({ ack, shortcut, client }) => {
  await ack();
  await client.views.open({ trigger_id: shortcut.trigger_id, view: buildCreateModal() });
});

/** 채널에 메시지 게시. 공개 채널에 봇이 없으면 자동으로 참여 후 재시도 */
async function postToChannel(client, channel, message) {
  try {
    return await client.chat.postMessage({ channel, ...message });
  } catch (err) {
    if (err.data?.error === 'not_in_channel' && channel.startsWith('C')) {
      await client.conversations.join({ channel });
      return client.chat.postMessage({ channel, ...message });
    }
    throw err;
  }
}

const channelErrorMessage = (code) => ({
  not_in_channel: '봇이 이 채널에 없어요. 비공개 채널이라면 채널에서 `/invite @lunchparty`로 봇을 초대해주세요.',
  channel_not_found: '봇이 이 채널에 접근할 수 없어요. 비공개 채널이라면 봇을 먼저 초대해주세요.',
  is_archived: '보관된 채널에는 모집할 수 없어요.',
  method_not_supported_for_channel_type: '이 대화에는 모집할 수 없어요. 다른 채널을 선택해주세요.',
}[code] || `메시지를 올리지 못했어요. (${code || '알 수 없는 오류'})`);

// 3) 모달 제출 → 검증 → 채널에 모집 메시지 게시
app.view(MODAL_CALLBACK_ID, async ({ ack, body, view, client, logger }) => {
  const raw = readModalValues(view.state.values);
  const { place, min, max, errors } = validateInput(raw);
  if (!raw.channel) errors.channel = '모집할 채널을 선택해주세요.';

  if (Object.keys(errors).length) {
    const slackErrors = {};
    for (const [field, msg] of Object.entries(errors)) slackErrors[BLOCK[field]] = msg;
    await ack({ response_action: 'errors', errors: slackErrors });
    return;
  }

  const party = createParty({ hostId: body.user.id, place, min, max, channel: raw.channel });
  try {
    const res = await postToChannel(client, raw.channel, buildPartyMessage(party));
    party.channel = res.channel;
    party.ts = res.ts;
    store.put(party);
    await ack(); // 모달 닫기
  } catch (err) {
    logger.error(err);
    await ack({ response_action: 'errors', errors: { [BLOCK.channel]: channelErrorMessage(err.data?.error) } });
  }
});

// 4) 참여 / 참여 취소 / 모집 확정 / 모집 취소 버튼
const ACTION_KIND = Object.fromEntries(Object.entries(ACTION).map(([kind, id]) => [id, kind]));

app.action(new RegExp(`^(${Object.values(ACTION).join('|')})$`), async ({ ack, action, body, client, respond, logger }) => {
  await ack();
  const reply = (text) => respond({ response_type: 'ephemeral', replace_original: false, text });

  const party = store.get(action.value);
  if (!party) {
    await reply('이 점심 파티 정보를 찾을 수 없어요. (오래되어 정리되었을 수 있어요)');
    return;
  }

  const result = applyAction(party, ACTION_KIND[action.action_id], body.user.id);
  if (result.error) {
    await reply(result.error);
    return;
  }

  store.put(party);
  try {
    await client.chat.update({ channel: party.channel, ts: party.ts, ...buildPartyMessage(party) });
    if (result.thread) {
      await client.chat.postMessage({ channel: party.channel, thread_ts: party.ts, text: result.thread });
    }
    if (result.ephemeral) await reply(result.ephemeral);
  } catch (err) {
    logger.error(err);
    await reply('처리 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.');
  }
});

app.error(async (err) => console.error('[bolt]', err));

(async () => {
  await app.start();
  console.log(`⚡ 점심 파티 봇 실행 중 (커맨드: ${COMMAND})`);
})();
