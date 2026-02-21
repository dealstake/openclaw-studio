"use client";

import { memo } from "react";
import { ChevronRight, FilePlus, RefreshCw } from "lucide-react";

import { PanelIconButton } from "@/components/PanelIconButton";
import type { Breadcrumb } from "../lib/breadcrumbs";

type WorkspaceBreadcrumbHeaderProps = {
  breadcrumbs: Breadcrumb[];
  loading: boolean;
  onNavigate: (path: string) => void;
  onNewFile: () => void;
  onRefresh: () => void;
};

export const WorkspaceBreadcrumbHeader = memo(function WorkspaceBreadcrumbHeader({
  breadcrumbs,
  loading,
  onNavigate,
  onNewFile,
  onRefresh,
}: WorkspaceBreadcrumbHeaderProps) {
  const total = breadcrumbs.length;

  return (
    <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-xs text-muted-foreground [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {breadcrumbs.map((crumb, i) => {
          // Collapse middle breadcrumbs when path is deep (4+ crumbs)
          if (total >= 4 && i > 0 && i < total - 2) {
            if (i === 1) {
              return (
                <span key="ellipsis" className="flex flex-shrink-0 items-center gap-1">
                  <ChevronRight className="h-3 w-3" />
                  <span className="px-1 py-0.5 text-muted-foreground/60">…</span>
                </span>
              );
            }
            return null;
          }
          return (
            <span key={crumb.path} className="flex flex-shrink-0 items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button
                type="button"
                className={`whitespace-nowrap rounded px-1 py-0.5 transition hover:bg-muted/60 ${
                  i === total - 1
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                }`}
                onClick={() => onNavigate(crumb.path)}
                title={crumb.label === "~" ? "Agent workspace root" : undefined}
              >
                {crumb.label}
              </button>
            </span>
          );
        })}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1 pl-2">
        <PanelIconButton
          onClick={onNewFile}
          aria-label="New file"
          data-testid="ws-new-file"
        >
          <FilePlus className="h-3.5 w-3.5" />
        </PanelIconButton>
        <PanelIconButton
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh workspace"
          data-testid="ws-refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </PanelIconButton>
      </div>
    </div>
  );
});
