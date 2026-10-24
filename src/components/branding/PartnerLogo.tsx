import { cn } from "@/lib/utils";

interface PartnerLogoProps {
  src?: string | null;
  alt?: string;
  size?: "sm" | "md" | "lg";
  rounded?: "lg" | "2xl";
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<PartnerLogoProps["size"]>, string> = {
  sm: "h-7 w-7 p-1",
  md: "h-9 w-9 p-1",
  lg: "h-14 w-14 p-2",
};

const ROUNDED_CLASS: Record<NonNullable<PartnerLogoProps["rounded"]>, string> = {
  lg: "rounded-lg",
  "2xl": "rounded-2xl",
};

// Caixa neutra de proporção fixa com `object-contain`: a logo nunca é
// cortada/distorcida, só encaixada — necessário porque parceiros enviam
// logos com proporções bem variadas (wordmarks largos, ícones altos, etc.).
export function PartnerLogo({ src, alt = "", size = "md", rounded = "lg", className }: PartnerLogoProps) {
  const sizeClass = SIZE_CLASS[size];
  const roundedClass = ROUNDED_CLASS[rounded];

  if (!src) {
    return <div className={cn(sizeClass, roundedClass, "bg-primary/10 ring-1 ring-primary/20 shrink-0", className)} />;
  }

  return (
    <div
      className={cn(
        sizeClass,
        roundedClass,
        "shrink-0 bg-white ring-1 ring-border flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
    </div>
  );
}
