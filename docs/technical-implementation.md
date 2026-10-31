# Technical implementation handoff

31 October 2026. Technical worker, before the sequential UX worker. Existing dirty and untracked work was retained; no commit, deployment, reset, or asset regeneration was performed.

## Core contracts

- `JOURNEY_STAGES = 3` in TypeScript and `journeyStages = 3` in Go. `worldOrder(seed)` returns tutorial world 0 plus two distinct seeded choices from worlds 1–4. The five-world catalog and assets remain available. Seed 42 is `[0,3,4]`. Durations remain 20/40/50 seconds per stage for easy/medium/hard; successful journeys require 60/120/150 seconds of simulation. Retry clears the current local log and rolls back that stage's score.
- One personal weekly table per difficulty includes both `verified` and `offline` entries. Week boundaries remain Monday, Moscow time. Provenance is returned for every server leaderboard row. Migrating existing SQLite databases adds `provenance DEFAULT 'offline'`; historical rows are never assumed proven.
- Server replay or an authoritative three-stage online victory alone creates verified rows. Every eligible player can name their result, including a ghost whose teammate finished. Defeats are device-local and never queued to the shared table.
- `POST /api/results` requires valid completed proof. Unknown, unfinished, expired, wrong-token and ineligible requests do not fall through to offline insertion. Same-name retry succeeds; different-name retry returns `name_conflict`; a valid proof whose row has not been persisted returns retryable `result_pending`.
- `POST /api/results/offline` explicitly publishes an unverified finish. It takes `{id,player,name,score,difficulty}`, no token. IDs are namespaced internally; retrying the same payload succeeds, changing name/score/difficulty conflicts. Names, player bounds, score and difficulty are validated. This endpoint intentionally trusts an offline claimed score and labels it accordingly.

## Delivery and UX handoff

`src/ranking.ts` exposes `RankingSubmission.state`: `device-only`, `pending`, `published`, `needs-retry`, or `storage-error`, alongside the retained `ok`/`offline` compatibility fields. Render these states directly; `offline` alone is not a success message. A permanent error has `ok:false`, is retained for review, and must not be described as awaiting automatic publication.

`queueJourneyFinish(id,{token,heroes,logs})` writes the full finish payload before name forms are created. `syncPendingRankings(api)` delivers finishes before dependent names and serializes concurrent synchronization calls. Permanent failures do not block unrelated entries. Accepted finish receipts remain durable so names can be retried after reload. Storage write/read failures propagate or return `storage-error`; they are not reported as successful durable saves.

`getPendingRankings()` and `getPendingFinishes()` provide retained state/error details for a reload/recovery panel. `retryPendingRanking(id,player)` enables a deliberate retry. `publishPendingOffline(id,player)` is an explicit user action for expired or rejected proof; it does not run automatically. A device-only defeat cannot be converted by this helper. The UX worker should add persistent result summaries and recovery controls, render leaderboard provenance, and replace five-world/team-winner copy with the three-stage/personal contract. Source copy outside the minimal integration remains that worker's responsibility. Minimal existing forms now respect `ok:false` and use `rankingDeliveryMessage`; the local final summary retains each saved delivery status rather than claiming every result was uploaded.

`RankingApiError` contains `status`, `code`, `message`, `retryable`. Relevant codes are `proof_unavailable`, `invalid_journey`, `invalid_log`, `journey_defeated`, `database_unavailable`, `result_pending`, `name_conflict`, and `offline_conflict`. Other legacy API routes may still return text errors; the shared API wrapper retains HTTP status and derives retryability for those responses.

## Online persistence and isolation

Room snapshots expose `persistence` (`pending`, `saved`, `error`, `device-only`) and `persistenceError`. Victory persistence uses an immutable player copy outside the global mutex, logs failures, and attempts at most three automatic writes with bounded delay. After that, a valid name submission triggers another manual persistence attempt; `result_pending` asks the caller to retry until it commits. Failed persistence rooms are retained beyond normal ten-minute finished-room cleanup, up to the existing two-hour room lifetime. SQLite primary keys make retries idempotent.

Socket snapshots are serialized under the mutex into immutable bytes and placed in a capacity-two queue per connection, replacing stale full-state snapshots. A single writer owns socket writes and deadlines. Replay, database queries/transactions and HTTP response writes execute outside the global mutex. State snapshots represent current lifecycle state, rather than a separate event stream.

Reconnect support: snapshots have `serverTime` in Unix milliseconds and each disconnected member has `reconnectDeadline`. `POST /api/rooms/{code}/status` with `{token}` supplies an authenticated snapshot while the socket is unavailable, without credentials in URLs. Match progress continues; the existing 30-second eligibility grace is enforced on reconnect as well as in the tick loop. The UX worker can use the authoritative server clock/deadline for U3.

## Rule parity

Client prediction and the TS control engine use `JUMP_VELOCITY`. Go now supports local dash physics, cooldown, immunity and collision rewards, and the current 500ms spell cooldown. The TS control engine no longer loses movement by updating a temporary body copy. Local logs are constrained to ticks below the last stage tick, including release actions at the end.

`server/testdata/parity.json` contains a deterministic 45-case matrix: three seeds × five catalog worlds × three difficulties, with route comparison and intermediate motion, grounded/fall, jump, duck, spell/dash cooldown, immunity, lives, score and round-score checks. It exercises ghost states and mixed inputs. `scripts/generate-rules-fixture.ts --check` verifies both fixtures without overwriting them. The old legacy fixture remains covered as well.

## Validation

- `npm test`: 73/73 pass, including concurrently added bonus-art tests, ordered durable finish/name delivery, retryable 503, permanent proof rejection, explicit offline conversion, storage failure, and device-only defeat.
- `npm run build`: strict TypeScript and Vite pass. Existing large-bundle warning remains (about 1.39 MB JS, 393 KB gzip); no bundle optimization was attempted.
- `go test -race ./...` and `go vet ./...`: pass. Covers replay acceptance/rejection and tick bounds, provenance, idempotent names, distinct conflicts/pending rows, injected SQLite insert failure followed by recovery, reconnect status, and slow-socket isolation.
- `node --experimental-strip-types scripts/generate-rules-fixture.ts --check`: both fixtures match, without rewriting during verification. The matrix also compares seeded three-stage order.
- Five-room race-instrumented isolation run, one unread large-snapshot socket: healthy room advanced 22 ticks, outbound queue remained at capacity 2; sampled tick-cadence p95 22.09 ms / p99 26.44 ms; input-lock p95 5.29 ms / p99 5.79 ms. These are short localhost regression samples, not production RTT or precise per-tick CPU durations. No trustworthy before-change timing baseline was captured.
- `qa_modes.py`: pass for solo, local pair, ghost control, retry rollback, four-player room, identical hero selection, reconnect, and ranking. It deliberately injects defeats; it is smoke evidence, not a natural winning replay.
- `qa_solo_ux.py`: pass for 667×375 through 1440×900, touch/cancel, pause, rotation and local pair. Its stale `.cast-mirror` assertion initially failed against the pre-existing dash UI; replacing that selector with `[data-dash="0"]` restored the intended control-bounds check. It maintains lives artificially and is only layout/control smoke.
- `qa_replay_delivery.py`: a natural-clock easy solo journey completed worlds `[0,3,1]` using ordinary scene jump/duck/cast/dash actions. It did not change lives, elapsed time, level, or invoke finish. The three real local logs had ticks `<1000`, Go accepted them, Go's calculated score equalled the browser's 1045, and the personal name published with `verified` provenance. A repeat on isolated snapshot `/tmp/jumping-technical-final.vLF9HF` also passed, with worlds `[0, 4, 3]` and server score `845`; querying the temporary SQLite database by that exact attempt ID confirmed one named verified row. `artifacts/qa/natural-replay.json` and phone/desktop PNGs retain diagnostic evidence.
- Phone and desktop result screenshots were inspected. The result form is readable but the phone screenshot scrolls the title out of view, and its submit label wraps tightly; final result layout remains UX-worker work.
- An earlier real-time replay run was interrupted by live-file/parallel-browser changes after stage one; `qa_new_worlds.py` also hit live-page reload (`scene` undefined). Neither is counted as a successful full replay. Stable source snapshots avoid this during the final repeat.

Own QA services on ports 5174, 5175, and 8080 were stopped before handoff. Temporary database `/tmp/jumping-technical-qa.sqlite`, snapshot `/tmp/jumping-technical-final.vLF9HF`, and test/build logs `/tmp/jumping-npm-test.log`, `/tmp/jumping-build.log` remain diagnostic artifacts; no production service was touched.

## Limits

This remains a small-room in-memory game server: room sessions and unfinished online persistence jobs do not survive process restart. Persisted result rows do survive; missing/expired proof is never silently downgraded. Additional bonus-art files/tests and related edits appeared concurrently; they were preserved and are not claimed as this worker's changes. Long-term queue retention/compaction, real child playtests, weak physical phones, long packet-loss sessions, and production load certification are outside this worker's evidence. The browser navigation smoke uses direct scene transitions and must not be described as natural replay validation.

## Files changed by this worker

Core/integration: `src/rules.ts`, `src/main.ts`, `src/network.ts`, `src/online-engine.ts`, `src/ranking.ts`; tests: `src/rules.test.ts`, `src/ranking.test.ts`.

Server: `server/main.go`, `server/engine.go`; tests: `server/main_test.go`, `server/online_test.go`, `server/replay_test.go`, `server/worlds_test.go`, `server/combat_test.go`, new `server/parity_test.go`, `server/results_contract_test.go`, `server/socket_isolation_test.go`; fixtures: `server/testdata/rules.json`, new `server/testdata/parity.json`.

Tooling: `scripts/generate-rules-fixture.ts`, `scripts/qa_new_worlds.py`, `scripts/qa_solo_ux.py`, new `scripts/qa_replay_delivery.py`; handoff: `docs/technical-implementation.md`. Files already dirty or untracked before this worker remain present; this list identifies files this worker additionally edited, not ownership of every diff in them.
