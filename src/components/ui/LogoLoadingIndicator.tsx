import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-6 w-6",
  md: "h-10 w-10",
  lg: "h-16 w-16",
} as const;

export function LogoLoadingIndicator({
  size = "md",
  label,
  className,
}: {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2", className)}>
      <img
        src="/joi-logo.svg"
        alt=""
        className={cn("animate-joi-pulse select-none", SIZES[size])}
        draggable={false}
      />
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}
