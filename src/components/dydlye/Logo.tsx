import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex h-full w-full items-center justify-center", className)}>
      <img
        src="Dydlye.png"
        alt="Dydlye Logo"
        className="h-full w-full object-contain"
        // نستخدم التحميل المسبق لضمان السرعة
        loading="eager"
      />
    </div>
  );
}
