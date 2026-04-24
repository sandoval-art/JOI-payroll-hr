import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-10 w-10",
  md: "h-16 w-16",
  lg: "h-24 w-24",
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
        src="/joi-favicon.svg"
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
