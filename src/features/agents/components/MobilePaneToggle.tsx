import type { FC } from "react";

export type MobilePane = "fleet" | "chat" | "context";

export type MobilePaneToggleProps = {
  mobilePane: MobilePane;
  contextMode: "agent" | "files";
  onPaneChange: (pane: MobilePane) => void;
  onEnsureContextMode: () => void;
};

export const MobilePaneToggle: FC<MobilePaneToggleProps> = ({
  mobilePane,
  contextMode,
  onPaneChange,
  onEnsureContextMode,
}) => {
  return (
    <div className="glass-panel p-2 xl:hidden" data-testid="mobile-pane-toggle">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          className={`rounded-md border px-2 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
            mobilePane === "fleet"
              ? "border-border bg-muted text-foreground shadow-xs"
              : "border-border/80 bg-card/65 text-muted-foreground hover:border-border hover:bg-muted/70"
          }`}
          onClick={() => onPaneChange("fleet")}
        >
          Fleet
        </button>
        <button
          type="button"
          className={`rounded-md border px-2 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
            mobilePane === "chat"
              ? "border-border bg-muted text-foreground shadow-xs"
              : "border-border/80 bg-card/65 text-muted-foreground hover:border-border hover:bg-muted/70"
          }`}
          onClick={() => onPaneChange("chat")}
        >
          Chat
        </button>
        <button
          type="button"
          className={`rounded-md border px-2 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] transition ${
            mobilePane === "context"
              ? "border-border bg-muted text-foreground shadow-xs"
              : "border-border/80 bg-card/65 text-muted-foreground hover:border-border hover:bg-muted/70"
          }`}
          onClick={() => {
            onEnsureContextMode();
            onPaneChange("context");
          }}
        >
          {contextMode === "files" ? "Files" : "Context"}
        </button>
      </div>
    </div>
  );
};
