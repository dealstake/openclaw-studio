"use client";

import { memo, useEffect } from "react";
import { Command as Cmdk } from "cmdk";
import type { CommandAction } from "../lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
}

const GROUP_LABELS: Record<string, string> = {
  navigation: "Navigation",
  actions: "Actions",
  agents: "Switch Agent",
};

const GROUP_ORDER = ["navigation", "actions", "agents"] as const;

export const CommandPalette = memo(function CommandPalette({
  open,
  onOpenChange,
  actions,
}: Props) {
  // Global Cmd+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onOpenChange]);

  if (!open) return null;

  // Group actions
  const grouped = new Map<string, CommandAction[]>();
  for (const action of actions) {
    const list = grouped.get(action.group) ?? [];
    list.push(action);
    grouped.set(action.group, list);
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-[201] flex items-start justify-center pt-[20vh] pointer-events-none">
        <div className="pointer-events-auto w-full max-w-lg mx-4 animate-in fade-in slide-in-from-top-4 duration-200">
          <Cmdk
            label="Command Palette"
            loop
            className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-border px-3">
              <svg
                className="h-4 w-4 shrink-0 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <Cmdk.Input
                placeholder="Type a command or search…"
                className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                autoFocus
              />
              <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                ESC
              </kbd>
            </div>
            <Cmdk.List className="max-h-72 overflow-y-auto p-2">
              <Cmdk.Empty className="py-6 text-center text-sm text-muted-foreground">
                No results found.
              </Cmdk.Empty>
              {GROUP_ORDER.map((groupKey) => {
                const items = grouped.get(groupKey);
                if (!items?.length) return null;
                return (
                  <Cmdk.Group
                    key={groupKey}
                    heading={GROUP_LABELS[groupKey]}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {items.map((action) => (
                      <CommandItem key={action.id} action={action} />
                    ))}
                  </Cmdk.Group>
                );
              })}
            </Cmdk.List>
          </Cmdk>
        </div>
      </div>
    </>
  );
});

const CommandItem = memo(function CommandItem({
  action,
}: {
  action: CommandAction;
}) {
  const Icon = action.icon;
  return (
    <Cmdk.Item
      value={action.label}
      keywords={action.keywords}
      onSelect={action.onSelect}
      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-foreground cursor-pointer select-none aria-selected:bg-accent aria-selected:text-accent-foreground transition-colors"
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className="flex-1 truncate">{action.label}</span>
      {action.shortcut && (
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
          {action.shortcut}
        </kbd>
      )}
    </Cmdk.Item>
  );
});
