# Activity Feature Audit

> Codebase audit of `src/features/activity/` — 17 files (7 components, 3 hooks, 4 lib, 3 supporting)

## Continuation Context
- **Last worked on**: 2026-03-01
- **Immediate next step**: Address P0 and P1 findings below
- **Blocked by**: Nothing
- **Context needed**: Read `src/features/activity/`, `reference/architecture.md`

## Summary

Overall quality: **Good**. Well-structured feature with clean separation (lib/hooks/components), proper memoization, virtualized lists, and good accessibility basics. Key concerns are around DRY violations in card components, missing error boundaries, and a potential performance issue in the message store's linear scans.

## Findings

### P0 — Critical

None found. No security issues, no data loss risks, no crashes.

### P1 — Should Fix

1. **Linear scan in activity message store** — `useActivityMessageStore.ts:upsertActivityMessage`, `appendActivityParts`, `finalizeActivityMessage` all use `messages.findIndex()` O(n) linear scan per operation. With MAX_ENTRIES=200 this is fine, but the pattern doesn't scale. A `Map<string, number>` index would make lookups O(1).
   - Files: `hooks/useActivityMessageStore.ts:94,113,134`

2. **Duplicated card layout pattern** — `ActivityMessageCard.tsx` and `HistoryEventCard.tsx` share ~80% identical layout structure (icon + title row + status + expand/collapse + action menu + trace button + metadata footer). This violates DRY and means UI changes must be applied in two places.
   - Files: `components/ActivityMessageCard.tsx`, `components/HistoryEventCard.tsx`
   - Suggestion: Extract a shared `ActivityCardShell` component that accepts render props for content/metadata.

3. **No error boundary around expanded content** — `MessagePartsRenderer` renders arbitrary markdown, tool results, and thinking blocks. If any part has malformed data, it will crash the entire ActivityPanel. Should wrap expanded content in an error boundary.
   - Files: `components/ActivityMessageCard.tsx:82`, `components/HistoryEventCard.tsx:82`

4. **`useCronAnalytics` doesn't abort batched fetches on signal** — The abort controller signal is checked between batches (`controller.signal.aborted`) but not passed to individual `fetchCronRuns` calls or the `client.call`. If the component unmounts mid-batch, in-flight RPCs complete unnecessarily.
   - File: `hooks/useCronAnalytics.ts:40-50`

5. **Token display duplication in HistoryEventCard** — Tokens are shown both in the expanded meta section (`↑X ↓Y`) AND in the footer (`Z tokens`). Both compute from the same data but use different formatting, creating visual inconsistency.
   - File: `components/HistoryEventCard.tsx:100-103,119-122`

### P2 — Nice to Have

6. **`formatTime` uses `toLocaleTimeString` without locale** — Relies on browser default locale, could produce inconsistent formatting across users. Should use explicit locale or the existing `Intl` pattern from `formatHistoryTime`.
   - File: `lib/activityDisplayUtils.ts:52-56`

7. **Unused `rtf` variable** — `Intl.RelativeTimeFormat` instance `rtf` is created at module level but `formatHistoryTime` constructs its own relative strings manually instead of using it.
   - File: `lib/activityDisplayUtils.ts:58`

8. **`heartbeatFilter` response detection is fragile** — The filter assumes the assistant response immediately follows the heartbeat user prompt (possibly with non-text parts between). If message ordering differs (e.g., interleaved streams), it could incorrectly remove non-heartbeat content.
   - File: `lib/heartbeatFilter.ts:47-58`

9. **`CronJobRankingTable` re-fetches runs on every collapse/expand** — `fetchedRef.current = false` on collapse means every re-expand triggers a new RPC. Could cache results for a brief TTL to reduce gateway load.
   - File: `components/CronJobRankingTable.tsx:35-38`

10. **Missing `key` stability for tool batch grouping** — `MessagePartsRenderer` uses index-based keys (`tool-${toolCallId}-${index}`). If parts reorder during streaming, React may incorrectly recycle nodes. Using `toolCallId` alone would be more stable.
    - File: `components/MessagePartsRenderer.tsx:39`

11. **`TrendSparkline` SVG has no `role` attribute** — Has `aria-label` but missing `role="img"` for proper screen reader announcement.
    - File: `components/TrendSparkline.tsx:31`

12. **`STATUS_COLORS` and `STATUS_PILL` use string keys** — Could be typed as `Record<ActivityStatus, ...>` for compile-time safety instead of `Record<string, ...>`.
    - File: `lib/activityDisplayUtils.ts:36,41`

## Implementation Plan

### Phase 1: DRY & Error Handling
- [ ] Extract shared `ActivityCardShell` from `ActivityMessageCard` and `HistoryEventCard`
- [ ] Add error boundary around expanded content in both card types
- [ ] Fix token display duplication in `HistoryEventCard`

### Phase 2: Performance
- [ ] Add `Map` index to `useActivityMessageStore` for O(1) lookups
- [ ] Pass abort signal through to `fetchCronRuns` / `client.call` in `useCronAnalytics`
- [ ] Add brief TTL cache for run history in `CronJobRankingTable`

### Phase 3: Polish
- [ ] Fix unused `rtf` variable — use it or remove it
- [ ] Type `STATUS_COLORS` / `STATUS_PILL` with `ActivityStatus`
- [ ] Add `role="img"` to `TrendSparkline` SVG
- [ ] Add explicit locale to `formatTime`

## Architecture Notes

- **State management**: Module-level store with `useSyncExternalStore` — clean pattern, avoids context overhead
- **Virtualization**: Uses `@tanstack/react-virtual` in both feeds — good for performance
- **Pagination**: Scroll-based infinite loading in `HistoryFeed` with dedup — solid
- **Separation**: Clean lib/hooks/components split following project conventions

## History
- 2026-03-01: Initial audit (Codebase Auditor cron). 17 files reviewed. 0 P0, 5 P1, 7 P2.
