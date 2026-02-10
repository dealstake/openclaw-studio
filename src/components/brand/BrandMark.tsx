import { TridentLogo } from "./TridentLogo";

const variants = {
  sm: { logo: 28 as const, main: "text-lg", sub: "text-[11px]", gap: "gap-2.5" },
  md: { logo: 36 as const, main: "text-2xl", sub: "text-xs", gap: "gap-3" },
  lg: { logo: 48 as const, main: "text-3xl", sub: "text-sm", gap: "gap-3.5" },
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
      <div className="min-w-0 overflow-hidden leading-none">
        <span className={`console-title whitespace-nowrap text-primary ${v.main} tracking-wide hidden sm:inline`}>
          TRIDENT FUNDING SOLUTIONS
        </span>
        <span className={`console-title whitespace-nowrap text-primary ${v.main} tracking-wide sm:hidden`}>
          TRIDENT
        </span>
      </div>
    </div>
  );
}
