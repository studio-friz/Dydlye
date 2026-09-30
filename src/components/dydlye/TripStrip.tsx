import { useCallback, useEffect, useState } from "react";
import type { TripItem } from "@/lib/tripPlanner";
import { getTrip, clearTrip, onTripChange } from "@/lib/tripPlanner";

interface Props {
  onSelect: (id: string) => void;
  onNavigateTo: (lat: number, lng: number) => void;
  showFullRoute: boolean;
  onToggleFullRoute: () => void;
}

export function TripStrip({ onSelect, onNavigateTo, showFullRoute, onToggleFullRoute }: Props) {
  const [trip, setTrip] = useState<TripItem[]>(() => getTrip());

  useEffect(() => {
    return onTripChange((t) => setTrip([...t]));
  }, []);

  const handleClear = useCallback(() => {
    clearTrip();
  }, []);

  if (trip.length === 0) return null;

  return (
    <div className="pointer-events-auto mx-auto mb-1 flex w-full max-w-3xl items-center gap-1 rounded-xl bg-surface-elevated/95 px-2 py-1.5 shadow-lg backdrop-blur-xl sm:gap-1.5 sm:px-3 sm:py-2">
      <span className="shrink-0 text-xs font-bold text-foreground/60">🗺️</span>
      <div className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5">
        {trip.map((item, i) => {
          const isCompleted = item.completed;
          const isFirstIncomplete = !isCompleted && (i === 0 || trip[i - 1]?.completed);
          return (
            <button
              key={item.id}
              onClick={() => {
                if (isCompleted && trip.length > i + 1) {
                  const next = trip[i + 1];
                  if (!next.completed) {
                    onNavigateTo(next.lat, next.lng);
                    onSelect(next.id);
                    return;
                  }
                }
                onNavigateTo(item.lat, item.lng);
                onSelect(item.id);
              }}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold transition active:scale-95 ${
                isCompleted
                  ? "bg-emerald-500/15 text-emerald-600"
                  : isFirstIncomplete
                    ? "bg-sky-500/15 text-sky-600 ring-1 ring-sky-500/30"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              <span className={isCompleted ? "" : "opacity-40"}>
                {isCompleted ? "✅" : `${i + 1}.`}
              </span>
              <span className="max-w-[80px] truncate sm:max-w-[100px]">{item.name}</span>
              {i < trip.length - 1 && (
                <svg
                  className="hidden h-3 w-3 shrink-0 text-muted-foreground/40 sm:block"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={onToggleFullRoute}
        className={`flex shrink-0 items-center justify-center rounded-lg p-1 transition ${
          showFullRoute ? "text-violet-500" : "text-muted-foreground/50 hover:text-foreground"
        }`}
        title={showFullRoute ? "إخفاء المسار" : "عرض المسار الكامل"}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </button>
      <button
        onClick={handleClear}
        className="flex shrink-0 items-center justify-center rounded-lg p-1 text-muted-foreground/50 hover:text-foreground transition"
        title="مسح الرحلة"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
