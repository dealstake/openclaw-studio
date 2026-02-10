# Low-Hanging Fruit: Easy Value Adds Based on Existing Architecture

_Analysis: 2026-02-09 — Cross-referencing our codebase, OpenClaw's Control UI source (Lit/Vite), and gateway protocol_

---

## Our Architecture Summary

**Layout**: 3-column responsive — Fleet sidebar (280px) | Chat (flex) | Context panel (360px)
**Context panel**: Tabbed system (`ContextPanel.tsx`) with `tasks | brain | settings`
**Event handling**: `classifyGatewayEventKind()` in `runtimeEventBridge.ts` routes events — currently 4 handled, rest dropped as `"ignore"`
**Styling**: Tailwind + semantic tokens (`bg-card`, `text-foreground`, `border-border`), `glass-panel`, mono uppercase labels, `rounded-md border border-border/80 bg-card/70 p-4` section cards
**Icons**: `lucide-react` only
**State**: `useReducer` in `store.tsx` with `AgentStoreProvider` context
**Deps**: React 19, Next.js 16, react-markdown, lucide-react, @noble/ed25519 — **no shadcn, no charting lib**

**Key pattern to follow**: Sections in `AgentInspectPanels.tsx` use this card pattern:
```tsx
<section className="rounded-md border border-border/80 bg-card/70 p-4">
  <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
    SECTION TITLE
  </div>
  {/* content */}
</section>
```

---

## The Prioritized List (Easiest → Harder)

### 🟢 TIER 1: One-file components, pure event listeners, no new deps

These can be added TODAY. They either listen to events we're already ignoring, or call RPC methods we've already called similar ones.

---

#### 1. **Exec Approval Overlay** ⏱️ ~2 hours
**Why first**: Agents silently block without this. P0 severity.
**What**: Modal overlay that appears when `exec.approval.requested` event fires. Shows command, agent, host, expiry countdown. Three buttons: Allow Once, Always Allow, Deny.
**Where**: New file `src/features/exec-approvals/components/ExecApprovalOverlay.tsx` + state in page.tsx
**Pattern match**: Exact same pattern as our existing delete/create/rename block modals (the `fixed inset-0 z-[100]` overlays in page.tsx lines 2290-2380). Same card styling.
**Data flow**:
  - Listen to `exec.approval.requested` event → parse payload → push to queue state
  - Listen to `exec.approval.resolved` event → remove from queue
  - Call `exec.approval.resolve` RPC with `{id, decision: "allow-once"|"allow-always"|"deny"}`
  - Countdown timer: `expiresAtMs - Date.now()`
**Reference**: OpenClaw's `views/exec-approval.ts` + `controllers/exec-approval.ts` — we translate their Lit templates to our React/Tailwind patterns
**Event handler change**: Add `"exec.approval.requested"` and `"exec.approval.resolved"` to `classifyGatewayEventKind()` → new kind `"exec-approval"`

---

#### 2. **Channel Status Indicators in Header** ⏱️ ~1.5 hours
**Why**: Instant operational visibility. "Are my channels healthy?"
**What**: Small status dots/pills in the HeaderBar showing channel health. Call `channels.status` on connect, refresh on `channels` event.
**Where**: Extend `HeaderBar.tsx` with channel pills + new `src/lib/gateway/channels.ts` for the RPC call
**Pattern match**: Same style as the "Connecting" badge already in HeaderBar. Status pills: green dot = connected, red = error, gray = not configured.
**Data**: `channels.status` returns `{channels: {whatsapp: {configured, running, connected, lastError}, telegram: {...}, ...}}`
**Event handler change**: Add `"channels"` to `classifyGatewayEventKind()` → trigger re-fetch of `channels.status`
**Minimal version**: Just dots. No config editing, no QR login. Pure read-only status.

---

#### 3. **Presence Indicators in Fleet Sidebar** ⏱️ ~1 hour  
**Why**: Know what's connected — CLI sessions, mobile nodes, other dashboards.
**What**: Small "online" indicator on agent rows + connected devices count in Fleet header.
**Where**: Extend `FleetSidebar.tsx` with presence data. `presence` event already triggers summary refresh — we just need to use the payload instead of ignoring it.
**Data**: `presence` event payload contains `{entries: [{deviceId, roles, clientId, agentId, ...}]}`. We already call `status` RPC which returns presence info — we're just not showing it.
**Pattern match**: Small dot next to agent avatar (green = active session, gray = idle).

---

#### 4. **Session Usage Summary in Agent Settings** ⏱️ ~2 hours
**Why**: Business customers need cost visibility per agent.
**What**: Add a "Usage" section to `AgentSettingsPanel` showing token count, cost, message count for the current session.
**Where**: New section in `AgentInspectPanels.tsx`, call `sessions.usage` RPC.
**Pattern match**: Same `<section className="rounded-md border...">` card as Identity/Display/Session/Cron sections.
**Data**: `sessions.usage` returns `{tokens: {input, output}, cost: {total, currency}, messages: {count}}`

---

#### 5. **Gateway Status Bar (Footer)** ⏱️ ~1.5 hours
**Why**: At-a-glance system health — version, uptime, node count, active sessions.
**What**: Thin footer bar across the bottom showing gateway version, uptime, total sessions, total agents, node count.
**Where**: New `src/features/status/components/StatusBar.tsx`, rendered in page.tsx after the main layout.
**Data**: Already calling `status` and `config.get` — just expose the data we already have.
**Pattern match**: Same `glass-panel` + mono uppercase labels as HeaderBar, but thinner (py-1).

---

### 🟡 TIER 2: New ContextPanel tabs, still using existing patterns

These require adding tabs to the ContextPanel but follow the exact same tabbed content pattern.

---

#### 6. **Channels Tab in ContextPanel** ⏱️ ~4 hours
**Why**: Full channel management — see all channels, their status, recent errors.
**What**: New `"channels"` tab in ContextPanel showing a card per channel with status, config status, last error, message count.
**Where**: `src/features/channels/components/ChannelsPanel.tsx` + new tab in `ContextPanel.tsx`
**ContextTab type change**: `"tasks" | "brain" | "settings" | "channels"`
**Pattern match**: Cards laid out like the cron job cards in AgentSettingsPanel (list of bordered cards with status indicators).
**Data**: `channels.status` RPC + `channels` event for live updates
**Scope**: Read-only status cards. NO config editing, NO QR login (those are complex and not low-hanging).

---

#### 7. **Sessions Tab in ContextPanel** ⏱️ ~3 hours
**Why**: See all sessions across agents — activity, age, token usage, ability to delete/compact.
**What**: New `"sessions"` tab showing session list with key, agent, updated timestamp, and basic actions (delete, compact).
**Where**: `src/features/sessions/components/SessionsPanel.tsx` + new tab
**Data**: Already calling `sessions.list` — just need to display all sessions, not just per-agent ones. Add `sessions.delete` and `sessions.compact` RPC calls.
**Pattern match**: Same card list as cron jobs. Each session = one card.

---

#### 8. **Cron Tab (Promoted from Settings)** ⏱️ ~3 hours
**Why**: Cron is currently buried inside per-agent Settings. Promote to its own tab for cross-agent visibility.
**What**: Move cron from agent settings section to standalone ContextPanel tab. Show all cron jobs across all agents. Add run history view per job.
**Where**: `src/features/cron/components/CronPanel.tsx` + `cron.runs` RPC
**Pattern match**: Existing cron cards from AgentSettingsPanel.tsx — lift them out and add job-run history rows below each job.

---

### 🔴 TIER 3: Requires more architecture but high value

These need new event handling patterns, new state management, or new layout areas.

---

#### 9. **Node Fleet Panel** ⏱️ ~5 hours
**Why**: Device management — see connected phones/Pis, their capabilities, battery, location.
**What**: Nodes panel showing all connected nodes with capabilities, last seen, invoke actions.
**Where**: `src/features/nodes/components/NodesPanel.tsx` + `node.list`, `node.describe` RPCs + `nodes`/`node` events
**Complexity**: Needs its own event handler for `nodes` push events, device state tracking, and possibly a detail view per node.

---

#### 10. **Log Viewer** ⏱️ ~5 hours
**Why**: Real-time gateway log tailing — essential for debugging.
**What**: Scrollable log viewer with level filters, auto-follow, search.
**Where**: `src/features/logs/components/LogViewer.tsx` + `logs.tail` RPC + `logs` event stream
**Complexity**: Streaming logs require a virtual scroll or at least a capped buffer. Would need thoughtful performance work.

---

#### 11. **Config Editor** ⏱️ ~8+ hours
**Why**: Full config editing from the dashboard.
**What**: Form-based config editor driven by `config.schema`, with diff view and apply/restart.
**Complexity**: The Control UI's config editor is their most complex view (form rendering from JSON schema, validation, diff, base-hash concurrency guard). Major feature, not a quick add.

---

#### 12. **Usage Dashboard (Full)** ⏱️ ~8+ hours
**Why**: Cost tracking with timeseries charts.
**What**: Dashboard with cost summaries, per-model breakdown, timeseries graphs.
**Complexity**: Needs a charting library (we don't have one). The Control UI uses custom CSS for its usage views. We'd need to either write pure CSS/SVG charts or add a dep.

---

## Recommended Implementation Order

```
Sprint 1 (Day 1-2): Tier 1 quick wins
  1. Exec Approval Overlay          ← P0, unblocks agents
  2. Channel Status Indicators      ← P0, operational visibility  
  3. Presence Indicators            ← enriches existing UI
  4. Session Usage in Settings      ← cost visibility per agent
  5. Gateway Status Bar             ← system-at-a-glance

Sprint 2 (Day 3-4): Tier 2 new tabs
  6. Channels Panel Tab             ← full channel visibility
  7. Sessions Tab                   ← session management
  8. Cron Tab (promoted)            ← cross-agent scheduling

Sprint 3 (Week 2): Tier 3 bigger features
  9. Node Fleet Panel
  10. Log Viewer
  11. Config Editor
  12. Usage Dashboard
```

---

## Event Handler Changes Needed

The single highest-leverage code change is expanding `classifyGatewayEventKind()` in `runtimeEventBridge.ts`:

```typescript
// BEFORE (handles 4 events)
export const classifyGatewayEventKind = (event: string): GatewayEventKind => {
  if (event === "presence" || event === "heartbeat") return "summary-refresh";
  if (event === "chat") return "runtime-chat";
  if (event === "agent") return "runtime-agent";
  return "ignore";
};

// AFTER (handles 10+ events)
export const classifyGatewayEventKind = (event: string): GatewayEventKind => {
  if (event === "presence" || event === "heartbeat") return "summary-refresh";
  if (event === "chat") return "runtime-chat";
  if (event === "agent") return "runtime-agent";
  if (event === "exec.approval.requested" || event === "exec.approval.resolved") return "exec-approval";
  if (event === "channels") return "channels-update";
  if (event === "sessions") return "sessions-update";
  if (event === "cron") return "cron-update";
  if (event === "nodes" || event === "node") return "nodes-update";
  if (event === "config") return "config-update";
  if (event === "skills") return "skills-update";
  if (event === "device.pair.requested" || event === "device.pair.resolved") return "device-pairing";
  return "ignore";
};
```

This one change unblocks ALL the new features. Each feature then adds its own handler case in `gatewayRuntimeEventHandler.ts`.

---

## Open Source Reference

**OpenClaw Control UI** (`ui/src/ui/`): Lit-based, not directly reusable, but the data contracts and event parsing are gold:
- `controllers/exec-approval.ts` — exact payload types + queue management (translate to React state)
- `controllers/channels.ts` — channel status types + polling
- `controllers/presence.ts` — presence entry parsing
- `controllers/sessions.ts` — session list + usage types
- `views/exec-approval.ts` — the 3-button approval card layout
- `views/channels.ts` — channel card grid with status dots
- `views/instances.ts` — presence list view
- `views/sessions.ts` — session management table

**Key insight**: We don't need to port their Lit templates. We take their TypeScript **types and controller logic** and render with our existing React/Tailwind patterns.
