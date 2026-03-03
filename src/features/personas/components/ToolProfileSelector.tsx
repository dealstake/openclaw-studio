"use client";

import { memo, useCallback, useState } from "react";
import { Shield, Globe, Code2, MessageSquare, MessageCircle } from "lucide-react";
import {
  type ToolProfile,
  TOOL_PROFILE_LABELS,
  TOOL_PROFILE_DESCRIPTIONS,
} from "../lib/personaTypes";

const TOOL_PROFILES: ToolProfile[] = ["full", "research", "development", "communication", "minimal"];

const PROFILE_ICONS: Record<ToolProfile, React.ReactNode> = {
  full: <Shield className="h-3.5 w-3.5" />,
  research: <Globe className="h-3.5 w-3.5" />,
  development: <Code2 className="h-3.5 w-3.5" />,
  communication: <MessageSquare className="h-3.5 w-3.5" />,
  minimal: <MessageCircle className="h-3.5 w-3.5" />,
};

interface ToolProfileSelectorProps {
  value: ToolProfile;
  onChange: (profile: ToolProfile) => void;
  disabled?: boolean;
}

export const ToolProfileSelector = memo(function ToolProfileSelector({
  value,
  onChange,
  disabled = false,
}: ToolProfileSelectorProps) {
  const [hoveredProfile, setHoveredProfile] = useState<ToolProfile | null>(null);
  const descriptionProfile = hoveredProfile ?? value;

  const handleSelect = useCallback(
    (profile: ToolProfile) => {
      if (!disabled) onChange(profile);
    },
    [onChange, disabled],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tool Profile">
        {TOOL_PROFILES.map((profile) => {
          const isSelected = profile === value;
          return (
            <button
              key={profile}
              type="button"
              role="radio"
              onClick={() => handleSelect(profile)}
              onMouseEnter={() => setHoveredProfile(profile)}
              onMouseLeave={() => setHoveredProfile(null)}
              disabled={disabled}
              className={`flex min-h-[44px] items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors
                ${isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-muted/10 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground"
                }
                disabled:cursor-not-allowed disabled:opacity-50`}
              aria-checked={isSelected}
            >
              {PROFILE_ICONS[profile]}
              {TOOL_PROFILE_LABELS[profile]}
            </button>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {TOOL_PROFILE_DESCRIPTIONS[descriptionProfile]}
      </p>
    </div>
  );
});
