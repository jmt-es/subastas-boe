import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative isolate flex items-center justify-center overflow-hidden rounded-[1rem] border border-[#d8d0c4] bg-[linear-gradient(180deg,#ffffff,#f6f1e8)] shadow-[0_12px_28px_rgba(22,32,50,0.08),inset_0_1px_0_rgba(255,255,255,0.88)]",
        className
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(39,75,139,0.12),transparent_44%)]" />
      <div className="relative flex h-[62%] w-[62%] flex-col items-center justify-between text-[#1f3c6d]">
        <span className="h-[12%] w-[86%] rounded-full bg-current/88" />
        <div className="flex h-[54%] w-[78%] items-end justify-between">
          <span className="h-full w-[18%] rounded-[0.22rem] bg-current/72" />
          <span className="h-full w-[18%] rounded-[0.22rem] bg-current" />
          <span className="h-full w-[18%] rounded-[0.22rem] bg-current/72" />
        </div>
        <span className="h-[11%] w-full rounded-full bg-current/88" />
      </div>
    </div>
  );
}
