import { TridentLogo } from "./TridentLogo";
import { BRANDING } from "@/lib/branding/config";

const variants = {
  sm: { logo: 28 as const, text: "text-2xl", gap: "gap-2.5" },
  md: { logo: 36 as const, text: "text-3xl", gap: "gap-3" },
  lg: { logo: 48 as const, text: "text-4xl", gap: "gap-3.5" },
} as const;

type BrandMarkProps = {
  size?: keyof typeof variants;
  className?: string;
};

export function BrandMark({ size = "md", className }: BrandMarkProps) {
  const v = variants[size];
  return (
    <div className={`flex items-center ${v.gap} ${className ?? ""}`}>
      <TridentLogo size={v.logo} className="shrink-0 text-primary" />
      <p className={`console-title leading-none text-foreground ${v.text}`}>
        {BRANDING.shortName}
      </p>
    </div>
  );
}
