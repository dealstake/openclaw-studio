import Image from "next/image";
import { useMemo } from "react";
import { TridentLogo } from "@/components/brand/TridentLogo";

type AgentAvatarProps = {
  seed: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  isSelected?: boolean;
};

export const AgentAvatar = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- seed kept for API compat
  seed,
  name,
  avatarUrl,
  size = 112,
  isSelected = false,
}: AgentAvatarProps) => {
  const src = useMemo(() => {
    const trimmed = avatarUrl?.trim();
    return trimmed || null;
  }, [avatarUrl]);

  const logoSize = Math.round(size * 0.6);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full border border-border/80 bg-card shadow-sm transition-transform duration-300 ${isSelected ? "agent-avatar-selected scale-[1.02]" : ""}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image
          className="pointer-events-none h-3/4 w-3/4 select-none object-contain"
          src={src}
          alt={`Avatar for ${name}`}
          width={size}
          height={size}
          unoptimized
          draggable={false}
        />
      ) : (
        <TridentLogo
          size={logoSize}
          className="pointer-events-none select-none text-primary"
          aria-label={`Avatar for ${name}`}
        />
      )}
    </div>
  );
};
