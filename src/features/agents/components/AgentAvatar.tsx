import Image from "next/image";
import { useMemo } from "react";

const TRIDENT_FALLBACK = "/branding/trident.svg";

type AgentAvatarProps = {
  seed: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  isSelected?: boolean;
};

export const AgentAvatar = ({
  seed,
  name,
  avatarUrl,
  size = 112,
  isSelected = false,
}: AgentAvatarProps) => {
  const src = useMemo(() => {
    const trimmed = avatarUrl?.trim();
    if (trimmed) return trimmed;
    return TRIDENT_FALLBACK;
  }, [avatarUrl]);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card shadow-sm transition-transform duration-300 ${isSelected ? "agent-avatar-selected scale-[1.02]" : ""}`}
      style={{ width: size, height: size }}
    >
      <Image
        className="pointer-events-none h-3/4 w-3/4 select-none object-contain text-primary"
        src={src}
        alt={`Avatar for ${name}`}
        width={size}
        height={size}
        unoptimized
        draggable={false}
      />
    </div>
  );
};
