import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center", className)}
      aria-hidden="true"
    >
      <Image src="/icon.svg" alt="" width={64} height={64} className="h-full w-full" />
    </span>
  );
}
