# UI/UX Audit — OpenClaw Studio (Trident Funding Solutions)

**Date:** 2026-02-09  
**Auditor:** Automated code review  
**Scope:** Full codebase review + screenshot observations at 1920×1080, 1024×768, 375×812  

---

## Executive Summary

The application is functionally solid with a cohesive dark-mode design language, good glassmorphism aesthetic, and well-structured component hierarchy. However, **page.tsx at 2782 lines is a critical maintainability risk**, several data display issues expose raw internal identifiers to business users, and mobile responsiveness needs targeted fixes. Below are 42 issues ranked by severity.

---

## P0 — Broken / Blocking

### 1. page.tsx is a 2782-line god component
- **Category:** Code Quality
- **Location:** `src/app/page.tsx` (entire file)
- **Problem:** Single component holds ~50 useState hooks, ~30 useCallback hooks, ~25 useEffect hooks, all gateway orchestration, all CRUD operations, all UI rendering. This is unmaintainable, untestable, and a merge-conflict magnet.
- **Fix:** Extract into at minimum:
  - `useGatewayAgents()` — agent loading, hydration, history sync (~lines 150–500)
  - `useConfigMutations()` — create/delete/rename agent queue (~lines 500–700 of callbacks)
  - `useCronManagement()` — cron loading, run, delete for settings panel
  - `useHeartbeatManagement()` — heartbeat CRUD
  - `useChannelsStatus()` — channels loading
  - `useSessionsManagement()` — sessions loading
  - `useExecApprovals()` — approval queue state
  - `useSpecialUpdates()` — heartbeat/cron latest update resolution
  - `<AgentStudioLayout>` — the 3-column responsive layout shell
  - `<ConfigMutationModals>` — create/rename/delete blocking modals (lines 2680–2782)
  - `<MobilePaneToggle>` — mobile tab bar component

### 2. Model dropdown shows raw provider/id for some models
- **Category:** Data Display
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:310–320`, `src/lib/gateway/models.ts:75–82`
- **Problem:** When a model isn't in the catalog (fallback path in `buildGatewayModelChoices`), it creates entries with `name: key` (e.g., `anthropic/claude-sonnet-4-6`). Business users see raw API identifiers.
- **Fix:** In `buildGatewayModelChoices`, when creating extras not in catalog, generate a human name:
  ```ts
  const humanName = id.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  extras.push({ provider, id, name: `${humanName} (${provider})` });
  ```

### 3. Sessions panel shows raw internal session keys
- **Category:** Data Display
- **Location:** `src/features/sessions/components/SessionsPanel.tsx:42–68`
- **Problem:** `humanizeSessionKey()` falls through to returning the raw key for unrecognized patterns. The gateway produces keys like `WEBCHAT:G-AGENT-ALEX-MAIN` which aren't caught by the `agent:name:type` parser.
- **Fix:** Improve the fallback: strip common prefixes, replace colons/hyphens with spaces, title-case the result. Add pattern for gateway-prefixed keys (`G-AGENT-*`).

---

## P1 — Significant UX Issues

### 4. Brand name truncates on mobile (375px)
- **Category:** Responsiveness
- **Location:** `src/components/brand/BrandMark.tsx:18–22`
- **Problem:** "TRIDENT FUNDING SOLUTIONS" is rendered as `whitespace-nowrap` in a `min-w-0 overflow-hidden` container. On narrow screens it truncates mid-word.
- **Fix:** Add responsive text: show abbreviation on mobile.
  ```tsx
  <span className={`console-title whitespace-nowrap text-primary ${v.main} tracking-wide hidden sm:inline`}>
    TRIDENT FUNDING SOLUTIONS
  </span>
  <span className={`console-title whitespace-nowrap text-primary ${v.main} tracking-wide sm:hidden`}>
    TRIDENT
  </span>
  ```

### 5. Header icons overlap on mobile
- **Category:** Responsiveness
- **Location:** `src/features/agents/components/HeaderBar.tsx:73–85`
- **Problem:** The header right section (`flex shrink-0 items-center gap-2`) doesn't wrap. At 375px, ThemeToggle + FilesToggle + MenuToggle + ConnectingIndicator + AvatarButton all compete for space.
- **Fix:** Hide less-essential buttons on mobile:
  - `AvatarButton` already hidden on sm. Good.
  - Hide `ThemeToggle` below `sm` — add `hidden sm:inline-flex` to wrapper
  - Or use a single hamburger menu below 640px that contains all header actions

### 6. "JUMP TO LATEST" button overlaps code blocks
- **Category:** Layout
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:210–220`
- **Problem:** Button is `absolute bottom-3 left-1/2 -translate-x-1/2` — on narrow widths it overlaps wide code blocks that extend to container edges.
- **Fix:** Add `max-w-[calc(100%-2rem)]` to the button, and add `z-10` to ensure it stays above markdown content. Consider moving it to a fixed bottom bar outside the scroll container.

### 7. Agent header takes too much vertical space on mobile
- **Category:** Responsiveness  
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:340–400`
- **Problem:** 96px avatar + model dropdown + thinking dropdown + status badge + settings button all render above the chat. On a 812px-tall phone, this consumes ~200px before any messages.
- **Fix:** On mobile (`sm:` breakpoint):
  - Reduce avatar to 48px
  - Collapse model/thinking selectors into a single row or hide behind a "Configure" button
  - Use `sm:flex-row flex-col` patterns to stack more efficiently

### 8. Thinking blocks lack proper collapse/expand UX
- **Category:** Interaction
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:56–72`
- **Problem:** Uses native `<details>` element with `[&::-webkit-details-marker]:hidden` but no visual indicator (chevron). Users see "Thinking" text but no affordance to expand/collapse. The `auto-expand` logic is good but users can't manually toggle easily.
- **Fix:** Add a chevron icon that rotates on open:
  ```tsx
  <summary className="...">
    <ChevronRight className="h-3 w-3 transition-transform [[open]>&]:rotate-90" />
    <span>Thinking</span>
  </summary>
  ```

### 9. No keyboard shortcut for sending messages
- **Category:** Interaction
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:252–260`
- **Problem:** Only Enter sends. No Cmd+Enter / Ctrl+Enter option. Power users who want multiline input (Shift+Enter works) may accidentally send.
- **Fix:** Consider configurable send shortcut. At minimum, document the Shift+Enter for newline behavior with a tooltip.

### 10. Delete agent uses `window.confirm()`
- **Category:** Interaction
- **Location:** `src/app/page.tsx:1505–1510`
- **Problem:** Native browser confirm dialog is jarring, unstyled, and inconsistent with the rest of the UI's glass-panel aesthetic. Business users expect a custom modal.
- **Fix:** Create a `<ConfirmDialog>` component matching the existing modal style (see create/rename/delete block modals as reference).

### 11. Tasks panel is just a "Coming Soon" placeholder
- **Category:** Data Display
- **Location:** `src/features/tasks/components/TasksPanel.tsx`
- **Problem:** It's the default tab in the context panel. Business users land on "Coming Soon" every time they open context. This looks unfinished.
- **Fix:** Either: (a) remove Tasks from tabs until implemented, defaulting to Brain or Channels, or (b) show actual useful content like a summary of recent agent activity.

### 12. Empty state messages are generic
- **Category:** Data Display
- **Location:** `src/features/agents/components/EmptyStatePanel.tsx`
- **Problem:** Messages like "No agents available." or "No messages yet." lack actionable guidance. The component supports `description` and `detail` props but they're often unused.
- **Fix:** Add helpful descriptions everywhere EmptyStatePanel is used:
  - Chat empty: "Send a message below to start a conversation with this agent."
  - Fleet empty with filter: "No agents match the '${filter}' filter. Try 'All' to see all agents."
  - Sessions empty: "Sessions appear here when agents are active."

### 13. Channels panel shows "Configured" with gray dot — ambiguous
- **Category:** Data Display
- **Location:** `src/features/channels/components/ChannelsPanel.tsx:70–80`
- **Problem:** "Configured" health means the channel exists in config but isn't connected. The gray dot (`bg-muted-foreground/50`) is ambiguous — users can't tell if it's working or broken.
- **Fix:** Use a yellow/amber dot for "configured but not connected" to distinguish from "error" (red) and "connected" (gold). Add a subtitle like "Not yet connected" instead of just "Configured".

### 14. No loading skeletons — content pops in
- **Category:** Performance
- **Location:** Multiple components
- **Problem:** Fleet sidebar, chat transcript, sessions panel, channels panel all show "Loading…" text strings. No skeleton screens, no shimmer animations. Content pops in causing layout shift.
- **Fix:** Create a `<Skeleton>` component (simple animated gray rectangles). Use in:
  - FleetSidebar: 3–4 skeleton agent rows
  - AgentChatPanel: skeleton message bubbles
  - SessionsPanel: skeleton session cards

---

## P2 — Polish

### 15. Inconsistent tab component patterns
- **Category:** Code Quality
- **Location:** `FleetSidebar.tsx` (filter buttons), `ContextPanel.tsx` (tab bar), `AgentInspectPanels.tsx` (file tabs)
- **Problem:** Three different implementations of tab/filter UIs with slightly different styling. ContextPanel uses `role="tablist"` (good). FleetSidebar uses `aria-pressed` (different pattern). Brain panel file tabs use neither.
- **Fix:** Extract a shared `<TabBar>` component with consistent ARIA attributes (`role="tablist"`, `role="tab"`, `aria-selected`).

### 16. No focus-visible rings on most interactive elements
- **Category:** Accessibility
- **Location:** Global — most buttons use `outline-none` or rely on browser defaults
- **Problem:** Keyboard users can't see focus indicators on fleet agent rows, tab buttons, or action buttons. The `outline-ring/50` in globals.css base layer helps but many components override with `outline-none`.
- **Fix:** Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1` to all interactive elements. Audit every `outline-none` usage.

### 17. Textarea placeholder "type a message" is lowercase
- **Category:** Typography
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:265`
- **Problem:** Placeholder text "type a message" is lowercase while all other UI text is uppercase mono. Inconsistent voice.
- **Fix:** Change to "Type a message…" (sentence case with ellipsis) or "MESSAGE" (matching the mono uppercase pattern).

### 18. Model dropdown truncates with ellipsis but no tooltip
- **Category:** Interaction
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:380–400`
- **Problem:** The `<select>` element has `overflow-hidden text-ellipsis whitespace-nowrap` but native selects don't show tooltips on truncated text.
- **Fix:** Add a `title` attribute with the full model name, or replace the native select with a custom dropdown that shows the full name on hover.

### 19. Color contrast issues in light mode
- **Category:** Accessibility / Color
- **Location:** `src/app/globals.css:22` — `--muted-foreground: oklch(0.44 0.016 252)`
- **Problem:** Muted foreground on light background (oklch 0.971) yields approximately 4.2:1 contrast ratio. This passes AA for large text but fails AA for the 9px/10px/11px mono text used extensively throughout. WCAG AA requires 4.5:1 for normal text.
- **Fix:** Darken muted-foreground to `oklch(0.38 0.016 252)` in light mode to ensure 4.5:1+ at all text sizes.

### 20. No error boundary
- **Category:** Code Quality
- **Location:** `src/app/layout.tsx`, `src/app/page.tsx`
- **Problem:** No React error boundary wraps the app. A rendering crash in any component shows a white screen.
- **Fix:** Add an `<ErrorBoundary>` component around `<AgentStudioPage>` that shows a branded error state with a "Reload" button.

### 21. Logout page uses `<meta>` refresh inside `<body>`
- **Category:** Code Quality
- **Location:** `src/app/logout/page.tsx:16`
- **Problem:** `<meta httpEquiv="refresh">` is rendered inside the component body (goes into `<body>`). It should be in `<head>`.
- **Fix:** Use Next.js `metadata` export or `useRouter` for client-side redirect after timeout.

### 22. Login page email flow is disabled but visible
- **Category:** Interaction
- **Location:** `src/app/login/page.tsx:75–110`
- **Problem:** The email input and button are visible but grayed out with `opacity-50` and `cursor-not-allowed`. This creates confusion — users may think the feature is broken rather than intentionally disabled.
- **Fix:** Either hide the email section entirely when disabled, or add explanatory text: "Email sign-in is not enabled for your organization."

### 23. StatusBar version and uptime not visible in screenshots
- **Category:** Data Display
- **Location:** `src/features/status/components/StatusBar.tsx:54–70`
- **Problem:** The StatusBar supports `gatewayVersion` and `gatewayUptime` props, but `loadGatewayStatus` in page.tsx (line ~640) only extracts from the hello frame. If the hello frame doesn't include `startedAtMs`, uptime is never shown.
- **Fix:** Verify the gateway hello frame includes `version` and `startedAtMs`. Add a fallback API call to `status` endpoint to get this data.

### 24. Live assistant text not rendered as markdown
- **Category:** Data Display
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:198`
- **Problem:** `liveAssistantText` is rendered as plain text (`{liveAssistantText}`) while final messages use `<ReactMarkdown>`. Users see raw markdown syntax during streaming.
- **Fix:** Wrap in `<ReactMarkdown remarkPlugins={[remarkGfm]}>{liveAssistantText}</ReactMarkdown>`.

### 25. No confirmation on session delete
- **Category:** Interaction
- **Location:** `src/features/sessions/components/SessionsPanel.tsx:117–140`
- **Problem:** Actually, this does have inline confirmation — good. But the "Are you sure?" text is generic.
- **Fix:** Change to "Delete session permanently? This cannot be undone." for clarity.

### 26. Cron panel delete has no confirmation
- **Category:** Interaction
- **Location:** `src/features/cron/components/CronPanel.tsx:145`
- **Problem:** Delete button fires immediately with no confirmation. Unlike sessions panel which has inline confirm.
- **Fix:** Add inline confirmation pattern matching SessionsPanel.

### 27. Menu dropdown uses `<details>` — doesn't close on outside click
- **Category:** Interaction
- **Location:** `src/features/agents/components/HeaderBar.tsx:95–120`
- **Problem:** Native `<details>` element doesn't close when clicking outside. Users must click the toggle again. This is a common gotcha.
- **Fix:** Add a click-outside handler or use a proper dropdown component (Radix UI Popover, etc.).

### 28. Agent brain panel "All changes saved" is always shown
- **Category:** Data Display
- **Location:** `src/features/agents/components/AgentInspectPanels.tsx:425`
- **Problem:** The text "All changes saved" appears even when dirty or when saving fails. It's a static label, not reflecting actual state.
- **Fix:** Conditionally show: dirty → "Unsaved changes", saving → "Saving…", error → error message, clean → "All changes saved".

### 29. No auto-save indicator or save button in brain editor
- **Category:** Interaction
- **Location:** `src/features/agents/components/AgentInspectPanels.tsx:380–430`
- **Problem:** Files auto-save on tab change, but there's no explicit save button or Cmd+S handler. Users may not realize saves happen on tab switch.
- **Fix:** Add a "Save" button (visible when dirty) and a Cmd+S keyboard shortcut.

### 30. Duplicated button styles across entire codebase
- **Category:** Code Quality
- **Location:** Multiple files
- **Problem:** The string `"rounded-md border border-border/80 bg-card/70 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]"` appears with minor variations in 15+ places.
- **Fix:** Extract shared button variants:
  ```tsx
  const buttonStyles = {
    primary: "rounded-md border border-transparent bg-primary/90 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground",
    secondary: "rounded-md border border-border/80 bg-card/70 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground",
    danger: "rounded-md border border-destructive/50 bg-transparent px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive",
  };
  ```
  Or use a `<Button variant="primary">` component.

### 31. Mixed indentation in page.tsx
- **Category:** Code Quality
- **Location:** `src/app/page.tsx` — lines ~1150–1170, 1780–1800, 2670+
- **Problem:** Some blocks use tabs, others use spaces. Visible in the raw file read.
- **Fix:** Run prettier with consistent settings. Add `.editorconfig`.

### 32. ChannelStatusPills abbreviations may be unclear
- **Category:** Data Display
- **Location:** `src/features/channels/components/ChannelStatusPills.tsx:37–48`
- **Problem:** Abbreviations like "GCHAT", "SIG", "SLK" may not be immediately obvious to non-technical business users.
- **Fix:** Show full name in tooltip (already done via `title` attribute — good). Consider using icons instead of abbreviations for the top 5 channels.

### 33. Artifacts panel hardcodes Trident branding in localStorage keys
- **Category:** Code Quality
- **Location:** `src/features/artifacts/components/ArtifactsPanel.tsx:30–31`
- **Problem:** `PINS_KEY = "trident-artifacts-pins"` and `SORT_KEY = "trident-artifacts-sort"` — hardcoded brand name in storage keys.
- **Fix:** Use generic keys like `"studio-artifacts-pins"` or derive from `BRANDING.shortName`.

---

## P3 — Nice to Have

### 34. No keyboard shortcuts for panel navigation
- **Category:** Interaction
- **Location:** Global
- **Problem:** No keyboard shortcuts for switching between Fleet/Chat/Context panels, or between context tabs.
- **Fix:** Add `Cmd+1/2/3` for panel focus, `Cmd+[/]` for context tabs.

### 35. No search/filter in sessions panel
- **Category:** Interaction
- **Location:** `src/features/sessions/components/SessionsPanel.tsx`
- **Problem:** With 8+ sessions, finding a specific one requires scrolling.
- **Fix:** Add a search input that filters by key, display name, or agent.

### 36. No toast/snackbar for transient notifications
- **Category:** Interaction
- **Location:** Global
- **Problem:** Success states (agent created, session deleted, etc.) have no visual confirmation. Users only see the UI update.
- **Fix:** Add a toast system for success/error notifications.

### 37. Avatar shuffle has no visual feedback
- **Category:** Interaction
- **Location:** `src/features/agents/components/AgentChatPanel.tsx:350–365`
- **Problem:** Clicking shuffle changes the avatar but there's no animation or transition.
- **Fix:** Add a brief rotation or fade animation on the avatar during shuffle.

### 38. Theme toggle has no system preference option
- **Category:** Interaction
- **Location:** `src/components/theme-toggle.tsx`
- **Problem:** Only light/dark toggle, no "follow system" option. Default is dark regardless of OS preference.
- **Fix:** Add a three-state toggle: Light / System / Dark.

### 39. formatRelativeTime doesn't handle future timestamps gracefully
- **Category:** Code Quality
- **Location:** `src/lib/text/time.ts:5`
- **Problem:** `if (elapsed < 0) return "just now"` — hides clock drift issues silently.
- **Fix:** Fine for now, but consider "in Xs" for small future values from clock skew.

### 40. No responsive font scaling
- **Category:** Typography
- **Location:** Global
- **Problem:** Font sizes are fixed (9px, 10px, 11px) regardless of viewport. These are already very small; on high-DPI mobile they may be hard to read.
- **Fix:** Consider `clamp()` based sizing or minimum 11px on mobile for body text.

### 41. ExecApprovalOverlay doesn't trap focus
- **Category:** Accessibility
- **Location:** `src/features/exec-approvals/components/ExecApprovalOverlay.tsx`
- **Problem:** Modal sets `aria-modal="true"` but doesn't trap keyboard focus. Users can tab to background elements.
- **Fix:** Add a focus trap (use `@radix-ui/react-focus-scope` or manual implementation). Apply same fix to create/rename/delete modals in page.tsx.

### 42. No `aria-live` regions for status updates
- **Category:** Accessibility
- **Location:** `StatusBar.tsx`, connection status indicators
- **Problem:** Status changes (connected → disconnected, agent running → idle) aren't announced to screen readers.
- **Fix:** Add `aria-live="polite"` to StatusBar and connection status indicators.

---

## Component Extraction Roadmap for page.tsx

Priority order for breaking up the 2782-line file:

| Priority | Extract | Lines saved | Complexity |
|----------|---------|-------------|------------|
| 1 | `useGatewayOrchestration()` hook — connection, agents list, models, config | ~400 | Medium |
| 2 | `useConfigMutationQueue()` hook — create/delete/rename lifecycle | ~350 | High |
| 3 | `<ConfigMutationModals>` component — 3 blocking modals | ~100 | Low |
| 4 | `useCronSettingsPanel()` hook — cron CRUD for settings | ~100 | Low |
| 5 | `useHeartbeatSettingsPanel()` hook — heartbeat CRUD | ~100 | Low |
| 6 | `useSpecialUpdates()` hook — heartbeat/cron latest update | ~120 | Medium |
| 7 | `<AgentStudioLayout>` component — 3-column responsive shell | ~200 | Low |
| 8 | `useExecApprovalQueue()` hook | ~50 | Low |
| 9 | `useChannelsStatus()` hook | ~50 | Low |
| 10 | `useAllSessions()` hook | ~50 | Low |

**Target:** page.tsx should be ~500 lines — layout orchestration and prop wiring only.

---

## Summary by Category

| Category | P0 | P1 | P2 | P3 |
|----------|----|----|----|----|
| Code Quality | 1 | 0 | 5 | 1 |
| Data Display | 2 | 4 | 3 | 0 |
| Responsiveness | 0 | 3 | 0 | 0 |
| Interaction | 0 | 3 | 4 | 4 |
| Accessibility | 0 | 0 | 2 | 2 |
| Layout | 0 | 1 | 0 | 0 |
| Typography | 0 | 0 | 2 | 0 |
| Performance | 0 | 1 | 0 | 0 |
| Color | 0 | 0 | 1 | 0 |
| **Total** | **3** | **12** | **17** | **7** |

**Bottom line:** Fix the 3 P0s (god component, raw model IDs, raw session keys) and the top 5 P1s (brand truncation, header overlap, jump button, mobile agent header, thinking blocks) before showing this to business stakeholders. The app works — it just needs polish to feel production-grade.
