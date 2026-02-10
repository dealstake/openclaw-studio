# OpenClaw Gateway WebSocket — Complete API Audit

_Generated 2026-02-09 from gateway source analysis (v2026.2.6-3) + Studio codebase cross-reference_

---

## How It Works

One WebSocket connection per client. The gateway protocol uses three frame types:
- **Request** (`type:"req"`) — client calls a method, gets a response
- **Response** (`type:"res"`) — gateway reply to a request
- **Event** (`type:"event"`) — server push (real-time updates)

Studio connects as `role: "operator"` with scopes `["operator.admin", "operator.approvals", "operator.pairing"]`.

---

## SECTION 1: RPC METHODS (Client → Gateway)

### Legend
- ✅ = Studio uses this today
- ⚠️ = Studio should use this (gap)
- ❌ = Not applicable for Studio (internal/node-only)
- 🔮 = Future consideration

---

### 1.1 Connection & Auth

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `connect` | Handshake — role, scopes, device auth, protocol negotiation | ✅ | Done in `GatewayBrowserClient.ts` |
| `web.login.start` | Start web login flow (returns token URL) | ❌ | For headless/CLI setups, not Studio |
| `web.login.wait` | Wait for web login completion | ❌ | Companion to above |

### 1.2 Agents & Identity

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `agents.list` | List all agents with config + session info | ✅ | Primary data source for Fleet sidebar |
| `agent.identity.get` | Get agent's IDENTITY.md parsed fields (name, emoji, vibe, avatar) | ⚠️ **GAP** | Rich identity data — avatar URL, creature type, emoji. Could power better agent cards |

### 1.3 Chat & Sessions

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `chat.send` | Send a message to agent session | ✅ | Chat panel |
| `chat.abort` | Abort current agent run | ✅ | Stop button |
| `chat.history` | Get message history for a session | ✅ | Load on agent select |
| `chat.subscribe` | Subscribe to real-time chat events for a session | ⚠️ **GAP** | Studio relies on broadcast events instead of explicit subscription. Explicit subscribe may give more reliable delivery |
| `chat.unsubscribe` | Unsubscribe from chat events | ⚠️ **GAP** | Companion to above |
| `chat.inject` | Inject a system message into a session | ⚠️ **GAP** | Useful for admin actions — inject instructions without going through chat.send |
| `sessions.list` | List sessions with filters | ✅ | Used for summary snapshots |
| `sessions.preview` | Get preview text for sessions | ✅ | Powers latest message preview in Fleet |
| `sessions.patch` | Update session settings (model, thinking level) | ✅ | Model/thinking toggle |
| `sessions.reset` | Reset/clear a session | ✅ | "New session" action |
| `sessions.delete` | Delete a session permanently | ⚠️ **GAP** | Admin cleanup tool. Control UI has it. |
| `sessions.compact` | Force compaction of a session | ⚠️ **GAP** | Admin tool — reduce token usage on long sessions |
| `sessions.resolve` | Resolve session key to full entry | 🔮 | Useful for diagnostics |
| `sessions.usage` | Get usage stats for a session | ⚠️ **GAP** | Token counts, costs, message counts per session. Critical for business dashboards |
| `sessions.usage.logs` | Get detailed usage log entries | ⚠️ **GAP** | Per-request cost breakdown |
| `sessions.usage.timeseries` | Usage over time | ⚠️ **GAP** | Charts/graphs for cost tracking |
| `usage.cost` | Get cost summary | ⚠️ **GAP** | Aggregate cost data across all agents |

### 1.4 Gateway Config

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `config.get` | Get full gateway config | ✅ | Used to read model config + agent list |
| `config.set` | Set individual config value | ❌ | `config.patch` preferred |
| `config.patch` | Partial config update | ✅ | Used in agentConfig.ts |
| `config.apply` | Apply full config (replace + restart) | ⚠️ **GAP** | Full config editor. Control UI has this. |
| `config.schema` | Get config JSON schema | ⚠️ **GAP** | Enables config editor with validation. Control UI has this. |
| `status` | Get gateway status snapshot | ✅ | Used for summary refresh |

### 1.5 Models

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `models.list` | List available models | ✅ | Model selector dropdown |

### 1.6 Channels (Messaging Surfaces)

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `channels.status` | Get status of all channels (Telegram, WhatsApp, Discord, etc.) | ⚠️ **GAP** | Critical for business — show which channels are connected/healthy/errored. Control UI has full channel panel |
| `channels.logout` | Logout from a channel | ⚠️ **GAP** | Admin action for channel management |

### 1.7 Cron / Scheduling

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `cron.status` | Get cron scheduler status | ⚠️ **GAP** | Is the scheduler running? Last tick time? |
| `cron.list` | List all cron jobs | ✅ (partial) | Referenced but not displayed in UI yet |
| `cron.add` | Create a new cron job | ⚠️ **GAP** | Schedule tasks from the dashboard |
| `cron.update` | Update an existing cron job | ⚠️ **GAP** | Edit schedules |
| `cron.remove` | Delete a cron job | ✅ (partial) | Referenced but no UI |
| `cron.run` | Trigger a job immediately | ✅ (partial) | Referenced but no UI |
| `cron.runs` | Get job run history | ⚠️ **GAP** | See when jobs ran, success/failure |

### 1.8 Nodes (Mobile/IoT Devices)

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `node.list` | List connected nodes (phones, Pis, etc.) | ⚠️ **GAP** | Show connected devices + capabilities. Control UI has full nodes panel |
| `node.describe` | Get detailed node info | ⚠️ **GAP** | Device model, OS, capabilities, permissions |
| `node.rename` | Rename a node | ⚠️ **GAP** | Admin action |
| `node.invoke` | Invoke a command on a node | ⚠️ **GAP** | Remote actions (camera snap, screen record, etc.) |
| `system.run` | Run a system command on a node | ❌ | Tool-level, not dashboard-level |

### 1.9 Device Pairing

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `device.pair.list` | List pending/approved pairings | ⚠️ **GAP** | Device management panel |
| `device.pair.approve` | Approve a pending device | ⚠️ **GAP** | Critical for security — approve new devices |
| `device.pair.reject` | Reject a pending device | ⚠️ **GAP** | Security action |
| `device.token.rotate` | Rotate a device token | ⚠️ **GAP** | Security hygiene |
| `device.token.revoke` | Revoke a device token | ⚠️ **GAP** | Emergency security action |

### 1.10 Exec Approvals

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `exec.approvals.get` | Get current exec approval config | ⚠️ **GAP** | Show what's auto-approved vs needs approval |
| `exec.approvals.set` | Update exec approval rules | ⚠️ **GAP** | Configure approval policies |
| `exec.approval.resolve` | Approve/deny a pending exec request | ⚠️ **GAP** | **HIGH PRIORITY** — agents waiting for human approval. Control UI has this. |
| `exec.approvals.node.get` | Get node-specific exec approvals | ⚠️ **GAP** | Node security settings |
| `exec.approvals.node.set` | Set node-specific exec approvals | ⚠️ **GAP** | Node security settings |

### 1.11 Skills

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `skills.status` | Get installed skills and their status | ⚠️ **GAP** | Show what skills each agent has. Control UI has full skills panel |
| `skills.install` | Install a new skill | ⚠️ **GAP** | Skill management from dashboard |
| `skills.update` | Update skills | ⚠️ **GAP** | Keep skills current |

### 1.12 Logs

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `logs.tail` | Tail gateway logs in real-time | ⚠️ **GAP** | Live log viewer. Control UI has this. Invaluable for debugging. |

### 1.13 Agent Files

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `agents.files.list` | List files in agent workspace | ✅ | Context panel |
| `agents.files.get` | Read a file from agent workspace | ✅ | File viewer |
| `agents.files.set` | Write a file to agent workspace | ✅ | File editor |

### 1.14 Update

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `update.run` | Run OpenClaw update | ⚠️ **GAP** | Update from dashboard instead of CLI |

### 1.15 TTS (Text-to-Speech)

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `tts.status` | Get TTS provider status | 🔮 | If TTS is configured |
| `tts.enable` | Enable TTS | 🔮 | |
| `tts.disable` | Disable TTS | 🔮 | |
| `tts.convert` | Convert text to speech | 🔮 | Play audio in browser |

### 1.16 Voice / VoiceWake

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `voicewake.get` | Get voicewake status | 🔮 | Voice activation monitoring |
| `voicewake.set` | Configure voicewake | 🔮 | |

### 1.17 Wizard (Onboarding)

| Method | Purpose | Studio | Notes |
|--------|---------|--------|-------|
| `wizard.start` | Start onboarding wizard | 🔮 | Could be useful for new agent setup |
| `wizard.next` | Advance wizard step | 🔮 | |
| `wizard.cancel` | Cancel wizard | 🔮 | |
| `wizard.status` | Get wizard state | 🔮 | |

---

## SECTION 2: GATEWAY EVENTS (Server → Client Push)

These are pushed over the WebSocket in real-time. This is where the Studio's real-time capabilities live or die.

### Legend
- ✅ = Studio handles this event
- ⚠️ = Studio should handle this (gap)
- ❌ = Not relevant for Studio

---

| Event | Purpose | Studio | What it tells you |
|-------|---------|--------|-------------------|
| `connect.challenge` | Auth handshake nonce | ✅ | Protocol-level, handled in client |
| **`presence`** | Device presence changed (connect/disconnect) | ✅ (triggers summary refresh) | Who's connected — CLI, nodes, other UIs. **Currently only triggers a summary reload — doesn't show presence data directly** |
| **`heartbeat`** | Gateway heartbeat tick | ✅ (triggers summary refresh) | Gateway is alive, session activity timestamps updated |
| **`chat`** | Chat message event (delta/final/abort/error) | ✅ | Core real-time chat streaming — agent thinking, tool calls, responses |
| **`agent`** | Agent runtime event (lifecycle, stream, tool) | ✅ | Agent start/stop, streaming text, tool execution, thinking traces |
| **`config`** | Config changed | ⚠️ **GAP** | Someone (CLI/agent) changed the gateway config. Studio should refresh config state. |
| **`cron`** | Cron job event (added/removed/triggered/completed) | ⚠️ **GAP** | Job scheduling activity — when jobs run, succeed, or fail |
| **`sessions`** | Session created/deleted/compacted | ⚠️ **GAP** | Session lifecycle — know when sessions are created or cleaned up |
| **`channels`** | Channel status changed (connected/disconnected/error) | ⚠️ **GAP** | **HIGH PRIORITY for business** — WhatsApp disconnected? Telegram errored? |
| **`nodes`** | Node connected/disconnected/updated | ⚠️ **GAP** | Device fleet changes — phone paired, Pi went offline |
| **`node`** | Individual node event | ⚠️ **GAP** | Specific node activity |
| **`skills`** | Skills installed/updated/removed | ⚠️ **GAP** | Skill changes — new capabilities added |
| **`device.pair.requested`** | New device wants to pair | ⚠️ **GAP** | **SECURITY** — needs immediate visibility + approve/reject action |
| **`device.pair.resolved`** | Pairing request approved/rejected | ⚠️ **GAP** | Pairing outcome |
| **`exec.approval.requested`** | Agent needs exec approval | ⚠️ **GAP** | **HIGH PRIORITY** — agent is blocked waiting for human to approve a command |
| **`exec.approval.resolved`** | Exec approval resolved | ⚠️ **GAP** | Approval outcome — approved, denied, timed out |
| **`logs`** | New log entry | ⚠️ **GAP** | Real-time log stream |
| **`usage`** | Usage data updated | ⚠️ **GAP** | Cost/token updates |
| **`update`** | Update available or in progress | ⚠️ **GAP** | OpenClaw update status |
| **`system`** | System-level event | ⚠️ **GAP** | Gateway restart, health changes |
| **`gateway`** | Gateway lifecycle event | ⚠️ **GAP** | Gateway starting, stopping, reloading |
| **`voice`** | Voice activity | 🔮 | Voice call events if configured |
| **`webhook`** | Webhook received/processed | ⚠️ **GAP** | External integrations firing |
| **`message`** | Message processing event | ⚠️ **GAP** | Message queue status — queued, processed, failed |
| **`queue`** | Queue activity | ⚠️ **GAP** | Message queue lane events |
| **`plug`** | Plugin event | 🔮 | Plugin lifecycle |

---

## SECTION 3: WHAT STUDIO DOES TODAY

### RPC Methods Used (12 of ~55+)
1. `connect` — handshake
2. `agents.list` — agent enumeration
3. `config.get` — config snapshot
4. `config.patch` — config updates
5. `models.list` — model options
6. `sessions.list` — session enumeration
7. `sessions.preview` — session latest text
8. `sessions.patch` — session model/thinking
9. `sessions.reset` — new session
10. `chat.send` — send message
11. `chat.abort` — abort run
12. `chat.history` — load history
13. `agents.files.list` — file browser
14. `agents.files.get` — file read
15. `agents.files.set` — file write
16. `status` — summary snapshot
17. `cron.list` — (referenced, minimal UI)
18. `cron.remove` — (referenced, minimal UI)
19. `cron.run` — (referenced, minimal UI)

### Events Handled (4 of ~25+)
1. `presence` → triggers summary refresh (doesn't display presence data)
2. `heartbeat` → triggers summary refresh
3. `chat` → real-time chat streaming (delta/final/abort/error)
4. `agent` → agent lifecycle + streaming (start/end/error, assistant/tool/thinking streams)

**Everything else is classified as `"ignore"` and silently dropped.**

---

## SECTION 4: PRIORITY GAPS (What We Should Build)

### 🔴 P0 — Critical for Business Dashboard

| Feature | Methods/Events Needed | Why |
|---------|----------------------|-----|
| **Exec Approval Queue** | `exec.approval.requested` event, `exec.approval.resolve` method, `exec.approvals.get` | Agents get BLOCKED waiting for human approval. If nobody sees it, the agent just hangs. This is the #1 gap. |
| **Channel Status Panel** | `channels.status` method, `channels` event | "Is WhatsApp connected? Did Telegram go down?" — critical operational visibility for any business using messaging channels |
| **Usage & Cost Dashboard** | `sessions.usage`, `sessions.usage.logs`, `sessions.usage.timeseries`, `usage.cost` | Business customers need to see how much they're spending on AI. Control UI has a full usage panel. |
| **Device Pairing Approval** | `device.pair.requested` event, `device.pair.approve`/`reject` methods, `device.pair.list` | Security — new devices requesting access need immediate visibility |

### 🟡 P1 — Important for Completeness

| Feature | Methods/Events Needed | Why |
|---------|----------------------|-----|
| **Presence Panel** | `presence` event (actually use the payload), `system-presence` | Show who/what is connected — CLI sessions, mobile nodes, other dashboards |
| **Cron Management UI** | `cron.status`, `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs`, `cron` event | Full scheduled task management — view, create, edit, trigger, see run history |
| **Node Fleet** | `node.list`, `node.describe`, `nodes`/`node` events | Connected devices — phones, Pis, cameras. Capabilities, status, health |
| **Config Editor** | `config.schema`, `config.apply`, `config` event | Edit gateway config from dashboard (Control UI already has a full form editor) |
| **Log Viewer** | `logs.tail`, `logs` event | Real-time gateway log stream — essential for debugging |
| **Session Management** | `sessions.delete`, `sessions.compact`, `sessions` event | Admin tools for session cleanup and maintenance |
| **Skills Panel** | `skills.status`, `skills.install`, `skills.update`, `skills` event | View/manage installed skills per agent |

### 🟢 P2 — Nice to Have

| Feature | Methods/Events Needed | Why |
|---------|----------------------|-----|
| **Agent Identity** | `agent.identity.get` | Richer agent cards with parsed IDENTITY.md fields |
| **Chat Subscribe/Unsubscribe** | `chat.subscribe`, `chat.unsubscribe` | Explicit subscription for more reliable event delivery |
| **System Inject** | `chat.inject` | Admin ability to inject system messages into agent sessions |
| **Update Management** | `update.run`, `update` event | Update OpenClaw from the dashboard |
| **Webhook Monitoring** | `webhook` event | See incoming webhooks and their processing status |
| **Message Queue** | `message`/`queue` events | Message processing pipeline visibility |
| **TTS Controls** | `tts.status/enable/disable/convert` | Voice features from dashboard |
| **VoiceWake** | `voicewake.get/set` | Voice activation management |
| **Security Tokens** | `device.token.rotate/revoke` | Token management for connected devices |

---

## SECTION 5: WHAT THE BUILT-IN CONTROL UI HAS THAT WE DON'T

The gateway ships with its own Control UI (`/` on the gateway port). Comparing its capabilities to Studio:

| Feature | Control UI | Studio | Gap |
|---------|-----------|--------|-----|
| Agent list + chat | ✅ | ✅ | — |
| Real-time streaming | ✅ | ✅ | — |
| File browser/editor | ✅ | ✅ | — |
| Model selection | ✅ | ✅ | — |
| Session settings | ✅ | ✅ | — |
| **Exec approvals overlay** | ✅ | ❌ | 🔴 |
| **Full config editor (form + raw)** | ✅ | ❌ | 🟡 |
| **Config schema validation** | ✅ | ❌ | 🟡 |
| **Channel status panel** | ✅ | ❌ | 🔴 |
| **Presence panel** | ✅ | ❌ | 🟡 |
| **Node list + details** | ✅ | ❌ | 🟡 |
| **Device pairing panel** | ✅ | ❌ | 🔴 |
| **Cron management** | ✅ | ❌ | 🟡 |
| **Session detail + usage** | ✅ | ❌ | 🔴 |
| **Usage/cost dashboard** | ✅ | ❌ | 🔴 |
| **Usage timeseries charts** | ✅ | ❌ | 🔴 |
| **Log viewer** | ✅ | ❌ | 🟡 |
| **Skills panel** | ✅ | ❌ | 🟡 |
| **Update runner** | ✅ | ❌ | 🟢 |
| **Wizard/onboarding** | ✅ | ❌ | 🟢 |

---

## SECTION 6: SUMMARY STATS

- **Total RPC methods available**: ~55+
- **Studio uses**: ~19 (34%)
- **Total push events**: ~25+
- **Studio handles**: 4 (16%) — drops the rest as "ignore"
- **Control UI handles**: ~20+ events (80%+)

### The Gap

Studio currently covers **chat + fleet view + file editing**. It's missing the entire **operational visibility layer**:
- No cost/usage tracking
- No channel health monitoring  
- No exec approval queue (agents silently block)
- No device/node management
- No cron/scheduled task UI
- No log viewer
- No presence visibility
- No config editor

For a "shippable agent dashboard for business use cases," the P0 gaps are table stakes.
