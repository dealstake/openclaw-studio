"use client";

import { memo, useMemo, useState } from "react";
import { formatCost, formatTokens } from "@/lib/text/format";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetClose,
  SideSheetBody,
  SideSheetTitle,
} from "@/components/ui/SideSheet";
import type { SessionCostEntry } from "@/features/usage/lib/costCalculator";

type SortKey = "displayName" | "cost" | "tokens" | "updatedAt";

interface SessionDrillDownProps {
  /** Label shown in the sheet header (e.g. "Feb 28" or "agent:alex") */
  title: string;
  /** Sessions to display */
  sessions: SessionCostEntry[];
  /** Whether the sheet is open */
  open: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
}

export const SessionDrillDown = memo(function SessionDrillDown({
  title,
  sessions,
  open,
  onClose,
}: SessionDrillDownProps) {
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return [...sessions].sort((a, b) => {
      switch (sortKey) {
        case "displayName":
          return dir * a.displayName.localeCompare(b.displayName);
        case "cost":
          return dir * ((a.cost ?? 0) - (b.cost ?? 0));
        case "tokens":
          return (
            dir *
            (a.inputTokens + a.outputTokens - (b.inputTokens + b.outputTokens))
          );
        case "updatedAt":
          return dir * ((a.updatedAt ?? 0) - (b.updatedAt ?? 0));
        default:
          return 0;
      }
    });
  }, [sessions, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const totalCost = useMemo(
    () => sessions.reduce((s, e) => s + (e.cost ?? 0), 0),
    [sessions],
  );

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <SideSheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SideSheetContent>
        <SideSheetHeader>
          <SideSheetTitle className="text-sm font-medium truncate">
            {title} — {sessions.length} session
            {sessions.length !== 1 ? "s" : ""} · {formatCost(totalCost)}
          </SideSheetTitle>
          <SideSheetClose />
        </SideSheetHeader>

        <SideSheetBody className="p-0">
          {sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">
              No sessions found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 sticky top-0">
                    {(
                      [
                        ["displayName", "Session", "text-left"],
                        ["cost", "Cost", "text-right"],
                        ["tokens", "Tokens", "text-right"],
                        ["updatedAt", "Last Active", "text-right"],
                      ] as const
                    ).map(([key, label, align]) => (
                      <th
                        key={key}
                        scope="col"
                        className={`px-3 py-2 font-medium text-muted-foreground ${align}`}
                        aria-sort={
                          sortKey === key
                            ? sortAsc
                              ? "ascending"
                              : "descending"
                            : "none"
                        }
                      >
                        <button
                          type="button"
                          className={`bg-transparent border-0 p-0 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors ${align}`}
                          onClick={() => handleSort(key as SortKey)}
                        >
                          {label}
                          {sortIndicator(key as SortKey)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr
                      key={s.key}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="px-3 py-2 font-medium text-foreground max-w-[180px] truncate">
                        {s.displayName}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {s.cost !== null ? formatCost(s.cost) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {formatTokens(s.inputTokens + s.outputTokens)}
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground text-xs">
                        {s.updatedAt
                          ? new Date(s.updatedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
