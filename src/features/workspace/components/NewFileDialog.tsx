"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

export const NewFileDialog = memo(function NewFileDialog({
  currentPath,
  onSubmit,
  onCancel,
  saving,
}: {
  currentPath: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  };

  const prefix = currentPath ? `${currentPath}/` : "";

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-3 mb-3 rounded-md border border-border/80 bg-card/70 p-3"
      data-testid="ws-new-file-form"
    >
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        New file
      </div>
      <div className="mt-2 flex items-center gap-2">
        {prefix ? (
          <span className="text-[11px] text-muted-foreground">{prefix}</span>
        ) : null}
        <input
          ref={inputRef}
          type="text"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background/80 px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/60"
          placeholder="filename.md"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          data-testid="ws-new-file-input"
        />
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          className="flex h-7 items-center gap-1 rounded-md border border-border/80 bg-card/70 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition hover:bg-muted/65 disabled:opacity-50"
          onClick={onCancel}
          disabled={saving}
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
        <button
          type="submit"
          className="flex h-7 items-center gap-1 rounded-md border border-transparent bg-primary/90 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-foreground transition hover:bg-primary disabled:opacity-50"
          disabled={saving || !name.trim()}
          data-testid="ws-new-file-submit"
        >
          <Check className="h-3 w-3" />
          {saving ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
});
