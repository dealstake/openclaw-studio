"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface PanelErrorFallbackProps {
  name: string;
  error: Error;
  onReset: () => void;
}

function isChunkError(error: Error): boolean {
  const msg = error.message || "";
  return (
    msg.includes("ChunkLoadError") ||
    msg.includes("Loading chunk") ||
    msg.includes("Failed to fetch dynamically imported module")
  );
}

function PanelErrorFallback({ name, error, onReset }: PanelErrorFallbackProps) {
  const chunk = isChunkError(error);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-destructive/70" aria-hidden />
      <div>
        <p className="text-sm font-medium text-foreground">
          {chunk ? "Update available" : `${name} crashed`}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {chunk
            ? "A new version has been deployed. Reload to get the latest."
            : error.message || "An unexpected error occurred"}
        </p>
      </div>
      <button
        type="button"
        onClick={chunk ? () => window.location.reload() : onReset}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/50"
      >
        <RefreshCw className="h-3 w-3" aria-hidden />
        {chunk ? "Reload page" : "Retry"}
      </button>
    </div>
  );
}

interface PanelErrorBoundaryProps {
  name: string;
  children: React.ReactNode;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

export class PanelErrorBoundary extends React.Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PanelErrorBoundary] ${this.props.name} crashed:`, error, info);

    // ChunkLoadError means a new deployment invalidated old chunks.
    // Force a full page reload to fetch fresh assets (once per session).
    const msg = error.message || "";
    if (
      msg.includes("ChunkLoadError") ||
      msg.includes("Loading chunk") ||
      msg.includes("Failed to fetch dynamically imported module")
    ) {
      const key = "__chunk_panel_reload";
      if (typeof window !== "undefined" && !sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        window.location.reload();
        return;
      }
    }
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <PanelErrorFallback
          name={this.props.name}
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }
    return this.props.children;
  }
}
