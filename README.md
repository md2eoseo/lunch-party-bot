# 🍱 점심 파티 슬랙 봇 — 설치 및 적용 가이드

슬랙에서 점심 식사 파티를 모집하고, 구성원들이 버튼을 눌러 참여할 수 있는 앱입니다.

설치 방법은 두 가지이며, **슬랙이 직접 호스팅하는 방식(방법 A)을 우선 권장**합니다.

---

## 1. 무엇을 할 수 있나요?

| 기능 | 설명 |
|---|---|
| 파티 만들기 | 채널 책갈피의 **🍱 점심 파티 모집** 링크(방법 A) 또는 `/lunch` 명령어(방법 B) → 입력 창(모달)에서 **장소/메뉴**, **최소·최대 인원**, **채널** 입력 |
| 장소/메뉴 | 자유 텍스트 (식당 이름, 메뉴 이름, 네이버·카카오·구글 지도 URL 등). URL은 자동으로 링크가 됩니다 |
| 인원 | 2~50명 사이 정수만 입력 가능. **최소 기본값 2명, 최대 기본값 50명** (비워두면 기본값). 주최자도 인원에 포함됩니다 |
| 🙋 참여하기 | 누구나 참여. 정원이 차면 더 이상 참여할 수 없습니다 |
| 참여 취소 | 참여자가 빠질 수 있습니다 (주최자는 [모집 취소] 사용) |
| ✅ 모집 확정 | 주최자 전용. 최소 인원 이상일 때만 가능, 참여자 전원에게 멘션 알림 |
| 모집 취소 | 주최자 전용. 참여자에게 취소 알림 |
| 자동 알림 | 최소 인원 달성 / 정원 마감 / 최소 인원 미만으로 감소 시 메시지 스레드에 알림 |

**입력 검증:** 2 미만·50 초과·소수 입력, 최소 > 최대, 빈 장소는 모달에서 바로 오류로 표시됩니다.

---

## 2. 어떤 방법으로 설치할까요?

| | **방법 A — 슬랙 호스팅 (권장)** | 방법 B — 직접 실행 |
|---|---|---|
| 코드 위치 | [`run-on-slack/`](run-on-slack/) (Deno/TypeScript) | [`src/`](src/) (Node.js) |
| 실행 장소 | **슬랙 서버** — 내 PC/서버를 켜둘 필요 없음 | 내 PC나 서버에서 항상 실행해야 함 |
| 데이터 저장 | 슬랙 내장 저장소(Datastore) | `data/parties.json` 파일 |
| 워크스페이스 조건 | **유료 플랜** (Pro, Business+, Enterprise Grid) | 무료 플랜 포함 모든 플랜 |
| 시작 방법 | 채널 책갈피 / 링크 버튼 (**`/lunch` 명령어는 지원 안 됨**) | `/lunch [장소]` 명령어, ⚡바로가기 |

> 워크스페이스가 무료 플랜이면 [방법 B](#방법-b--직접-실행-nodejs)로 가세요. 플랜은 슬랙 왼쪽 위 워크스페이스 이름 → **설정 및 관리 → 워크스페이스 설정**(또는 *도구 및 설정*)에서 확인할 수 있습니다.

---

## 방법 A — 슬랙 호스팅 (Run on Slack)

슬랙 CLI로 코드를 슬랙 서버에 한 번 배포하면 끝입니다. 이후에는 아무것도 켜둘 필요가 없습니다.

### A-1. 준비물

- **유료 플랜** 슬랙 워크스페이스, 앱 설치 권한 (관리자가 앱 승인을 요구하는 워크스페이스라면 승인 요청)
- 터미널을 쓸 수 있는 PC (맥 / 리눅스 / 윈도우) — 배포할 때만 필요

### A-2. 슬랙 CLI 설치 (최초 1회)

맥 / 리눅스:

```bash
curl -fsSL https://downloads.slack-edge.com/slack-cli/install.sh | bash
```

윈도우 (PowerShell):

```powershell
irm https://downloads.slack-edge.com/slack-cli/install-windows.ps1 | iex
```

설치 스크립트가 실행에 필요한 **Deno**도 함께 설치합니다. 설치 확인:

```bash
slack version
```

> 리눅스에서 `slack` 명령이 슬랙 데스크톱 앱과 겹치면, 설치 스크립트가 안내하는 다른 이름(예: `slack-cli`)을 쓰세요.

### A-3. 슬랙 로그인 (최초 1회)

```bash
slack login
```

1. 터미널에 `/slackauthticket ABC...` 같은 명령어가 표시됩니다.
2. 슬랙 아무 채널(또는 나와의 DM)에 그 명령어를 그대로 붙여넣고 보냅니다.
3. 슬랙에 뜨는 **인증 코드**를 터미널에 입력하면 로그인 완료.

### A-4. 배포

```bash
cd lunch-party-bot/run-on-slack
```

```bash
slack deploy
```

- 처음 배포할 때 설치할 워크스페이스를 고르라고 물어보면 선택합니다.
- **트리거를 만들지** 물어보면 `triggers/lunch_link.ts`를 선택합니다.
  (물어보지 않았다면 직접 만드세요: `slack trigger create --trigger-def triggers/lunch_link.ts`)
- 완료되면 `https://slack.com/shortcuts/Ft.../...` 형태의 **링크**가 출력됩니다. 이 링크를 복사해두세요.

> 💡 배포 전에 미리 시험해보고 싶다면 `slack run`을 실행하세요. 내 PC에서 임시 "(local)" 앱으로 동작하며, `Ctrl+C`로 끄면 멈춥니다. 실제 운영은 `slack deploy`로 합니다.

### A-5. 채널에 링크 걸기

1. 점심 파티를 모집할 채널을 엽니다.
2. 채널 이름 아래 **책갈피 바(+ 책갈피 추가)** → **링크 추가** → A-4에서 받은 링크 붙여넣기, 이름은 `🍱 점심 파티 모집`.
3. (또는) 채널에 링크를 메시지로 보내면 **[시작]** 버튼이 있는 카드가 생깁니다. 이 메시지를 고정(📌)해두면 편합니다.

**비공개 채널**이라면 먼저 앱을 초대하세요: 채널에서 `/invite @점심 파티`. 공개 채널은 앱이 자동으로 들어갑니다.

### A-6. 사용하기

1. 책갈피(또는 링크 카드의 [시작])를 누르면 입력 창이 열립니다.
2. 장소/메뉴, 최소·최대 인원(비우면 2명 / 50명)을 입력하고 **모집 시작**.
3. 채널에 모집 메시지가 올라가고, 구성원들이 **🙋 참여하기**를 누릅니다.
4. 주최자가 **✅ 모집 확정** 또는 **모집 취소**를 누르면 종료됩니다.

### A-7. 수정 · 관리

| 하고 싶은 것 | 방법 |
|---|---|
| 코드/문구 수정 반영 | `run-on-slack/` 안의 파일 수정 후 다시 `slack deploy` |
| 실시간 로그 보기 | `slack activity --tail` |
| 저장된 파티 데이터 보기 | `slack datastore query '{"datastore": "lunch_parties"}'` |
| 링크(트리거) 목록 / 삭제 | `slack trigger list` / `slack trigger delete --trigger-id Ft...` |
| 앱 삭제 | `slack delete` |

인원 범위·기본값은 [`run-on-slack/functions/lunch_party/party.ts`](run-on-slack/functions/lunch_party/party.ts) 상단, 메시지 디자인은 [`blocks.ts`](run-on-slack/functions/lunch_party/blocks.ts)에 있습니다. 수정 후 테스트: `deno task test`

### A-8. 문제 해결 (방법 A)

| 증상 | 원인 / 해결 |
|---|---|
| `slack deploy` 시 플랜 관련 오류 | 무료 플랜 워크스페이스 → 방법 B 사용 |
| 배포는 됐는데 설치가 안 됨 / 승인 대기 | 워크스페이스 관리자의 앱 승인 필요 |
| 입력 창에서 "봇이 이 채널에 없어요" | 비공개 채널 → `/invite @점심 파티` 후 다시 시도 |
| 링크를 눌러도 아무 반응이 없음 | `slack trigger list`로 트리거가 있는지 확인, 없으면 A-4의 `slack trigger create` |
| 버튼이 반응하지 않음 | `slack activity --tail`로 오류 확인. 코드 수정 후 `slack deploy` |

> 참고: 두 사람이 **정확히 같은 순간**에 버튼을 누르면 드물게 한 명의 참여가 반영되지 않을 수 있습니다(슬랙 저장소에 동시 쓰기 잠금이 없음). 참여자 목록에 이름이 없으면 다시 누르면 됩니다.

---

## 방법 B — 직접 실행 (Node.js)

무료 플랜이거나, `/lunch` 명령어를 꼭 쓰고 싶을 때의 방법입니다. 이 방식은 **봇 프로그램이 켜져 있는 동안에만** 동작하므로 항상 켜진 서버에서 실행하세요(B-5).

**사용 예시**

```
/lunch                                  → 빈 입력 창이 열림
/lunch 을지로 노가리골목 김치찌개       → 장소가 미리 채워진 입력 창이 열림
/lunch https://naver.me/xxxxxx
```

### B-1. 준비물

- 슬랙 워크스페이스에 **앱을 설치할 권한** (없다면 워크스페이스 관리자에게 승인 요청)
- 봇을 실행할 컴퓨터/서버에 **Node.js 18 이상**
- 이 프로젝트 폴더 (`lunch-party-bot/`, 코드는 `src/`)

> 이 봇은 **Socket Mode**를 사용합니다. 공개 URL·도메인·HTTPS 인증서가 필요 없고, 인터넷에 연결된 PC/서버에서 `npm start`로 실행합니다. 단, 프로그램이 꺼지면 버튼과 명령어가 멈춥니다.

### B-2. 슬랙 앱 만들기 (약 5분)

#### B-2-1. 매니페스트로 앱 생성

1. <https://api.slack.com/apps> 접속 → **Create New App**
2. **From a manifest** 선택 → 설치할 워크스페이스 선택
3. 형식을 **YAML**로 바꾸고, 프로젝트의 [`manifest.yml`](manifest.yml) 내용을 그대로 붙여넣기 → **Next** → **Create**

매니페스트에는 아래 설정이 모두 들어 있습니다.

- 슬래시 커맨드 `/lunch`
- 전역 바로가기 "점심 파티 만들기"
- 인터랙티비티(버튼/모달) + Socket Mode 활성화
- 봇 권한(Scopes): `commands`, `chat:write`, `channels:join`

> `/lunch`가 이미 다른 앱에서 쓰이고 있다면 매니페스트의 `command`를 `/lunchparty` 같은 다른 영문 이름으로 바꾸고, `.env`의 `SLASH_COMMAND`도 같게 맞춰주세요.

#### B-2-2. 앱 레벨 토큰 발급 (`xapp-…`)

1. 앱 설정 왼쪽 메뉴 **Basic Information** → 아래쪽 **App-Level Tokens** → **Generate Token and Scopes**
2. 이름: 아무거나 (예: `socket`), Scope: **`connections:write`** 추가 → **Generate**
3. 표시되는 `xapp-...` 토큰 복사

#### B-2-3. 워크스페이스에 설치 + 봇 토큰 (`xoxb-…`)

1. 왼쪽 메뉴 **Install App** (또는 OAuth & Permissions) → **Install to Workspace** → 허용
2. **Bot User OAuth Token** (`xoxb-...`) 복사

> ⚠️ 두 토큰은 비밀번호와 같습니다. 채팅방이나 Git에 올리지 마세요. (`.gitignore`에 `.env`가 이미 포함되어 있습니다.)

### B-3. 봇 실행하기

```bash
cd lunch-party-bot
```

```bash
npm install
```

```bash
cp .env.example .env
```

`.env` 파일을 열어 B-2에서 복사한 두 토큰을 넣습니다.

```dotenv
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...
```

실행:

```bash
npm start
```

`⚡ 점심 파티 봇 실행 중 (커맨드: /lunch)` 이 출력되면 성공입니다. 이제 슬랙 아무 채널에서 `/lunch`를 입력해보세요.

(선택) 로직 테스트: `npm test`

### B-4. 채널에서 사용하기

- **공개 채널:** 별도 작업 없이 바로 사용 가능합니다. 봇이 채널에 없으면 자동으로 참여합니다.
- **비공개 채널:** 먼저 봇을 초대해야 합니다.
  ```
  /invite @lunchparty
  ```
- 모달의 "모집할 채널"은 명령어를 입력한 채널로 자동 선택되며, 다른 채널로 바꿀 수도 있습니다.

### B-5. 항상 켜두기 (운영 배포)

봇 프로세스가 꺼지면 버튼과 명령어가 동작하지 않습니다. 팀에서 계속 쓰려면 항상 켜져 있는 서버에서 실행하세요.

**방법 A — PM2 (리눅스/맥 서버, 가장 간단)**

```bash
npm install -g pm2
```

```bash
pm2 start src/app.js --name lunch-party-bot
```

```bash
pm2 save && pm2 startup
```

**방법 B — Docker**

`Dockerfile` 예시:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
CMD ["node", "src/app.js"]
```

```bash
docker build -t lunch-party-bot .
```

```bash
docker run -d --restart=always --env-file .env -v $(pwd)/data:/app/data lunch-party-bot
```

**방법 C — 클라우드 PaaS** (Render, Railway, Fly.io, AWS EC2/Lightsail 등)
웹 서버가 아닌 **백그라운드 워커(Worker)** 타입으로 배포하고, 환경변수에 `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`을 등록하면 됩니다. Socket Mode라서 포트 개방이 필요 없습니다.

**데이터 저장:** 진행 중인 파티는 `data/parties.json`에 저장되어 재시작해도 유지되며, 7일이 지난 파티는 자동 정리됩니다. 컨테이너/PaaS에서는 이 폴더를 볼륨으로 연결하거나 `DATA_FILE` 환경변수로 경로를 지정하세요. 봇은 **하나의 프로세스로만** 실행하세요 (여러 개를 띄우면 참여자 목록이 서로 어긋납니다).

### B-6. 문제 해결 (방법 B)

| 증상 | 원인 / 해결 |
|---|---|
| 실행 시 `invalid_auth` | 토큰이 잘못됨. `.env`의 두 토큰을 다시 복사 (xoxb ↔ xapp 바뀌지 않았는지 확인) |
| `/lunch` 입력 시 "dispatch_failed" / 응답 없음 | 봇 프로세스가 꺼져 있음. `npm start` 상태 확인 |
| `/lunch`가 목록에 안 보임 | 앱 설치가 안 됨, 또는 매니페스트 수정 후 **재설치(Reinstall)** 필요 |
| 모달에서 "봇이 이 채널에 없어요" | 비공개 채널 → `/invite @lunchparty` 후 다시 시도 |
| 버튼 눌렀더니 "파티 정보를 찾을 수 없어요" | `data/` 폴더가 지워졌거나 7일이 지난 파티 |
| 매니페스트 수정 후 반영 안 됨 | 권한(Scope)을 바꿨다면 Install App에서 재설치 |

---

---

## 프로젝트 구조

```
lunch-party-bot/
├── README.md                     # 이 가이드
│
├── run-on-slack/                 # ── 방법 A: 슬랙 호스팅 (Deno) ──
│   ├── manifest.ts               # 앱 이름, 권한, 워크플로/저장소 등록
│   ├── triggers/lunch_link.ts    # 채널 책갈피용 링크 트리거
│   ├── workflows/lunch_party.ts  # 링크 → 함수 실행 연결
│   ├── datastores/parties.ts     # 파티 저장소 정의
│   └── functions/lunch_party/
│       ├── mod.ts                # 모달 제출 · 버튼 처리
│       ├── party.ts              # 입력 검증 + 참여/취소/확정 로직
│       ├── blocks.ts             # 모달 · 모집 메시지 UI
│       └── party_test.ts
│
├── manifest.yml                  # ── 방법 B: 직접 실행 (Node.js) ──
├── .env.example
├── src/ (app.js, party.js, views.js, store.js)
└── test/party.test.js
```

두 방법의 화면과 동작(입력 항목, 검증 규칙, 버튼, 알림)은 같습니다. 로직을 바꿀 때는 사용하는 쪽의 `party`/`blocks`(`views`) 파일을 수정하세요.
