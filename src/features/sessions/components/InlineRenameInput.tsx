"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";

type InlineRenameInputProps = {
  initialValue: string;
  onSave: (value: string) => void;
  onCancel: () => void;
};

export const InlineRenameInput = memo(function InlineRenameInput({
  initialValue,
  onSave,
  onCancel,
}: InlineRenameInputProps) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        const trimmed = value.trim();
        if (trimmed && trimmed !== initialValue) onSave(trimmed);
        else onCancel();
      } else if (e.key === "Escape") {
        onCancel();
      }
    },
    [value, initialValue, onSave, onCancel],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      className="w-full rounded border border-primary/40 bg-card px-1 py-0 text-base md:text-[13px] font-medium leading-tight text-foreground outline-none ring-1 ring-primary/20"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
    />
  );
});
