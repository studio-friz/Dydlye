import { memo } from "react";
import type { House } from "@/data/houses";
import { useSettings, formatPrice } from "@/i18n/useTranslation";
import { useFavorites } from "@/hooks/useFavorites";

interface Props {
  house: House;
  onClick?: () => void;
  compact?: boolean;
}

const typeBadge: Record<House["type"], { bg: string; label: string }> = {
  فيلا: { bg: "from-violet-600 to-purple-700", label: "Villa" },
  شقة: { bg: "from-sky-500 to-blue-600", label: "Appartement" },
  رياض: { bg: "from-amber-500 to-orange-600", label: "Riad" },
  استوديو: { bg: "from-emerald-500 to-green-600", label: "Studio" },
};

export const HouseCard = memo(function HouseCard({ house, onClick, compact }: Props) {
  const { t, currency, locale } = useSettings();
  const { has, toggle } = useFavorites();

  const typeKey = (type: string): string => {
    const map: Record<string, string> = {
      فيلا: "type.villa",
      شقة: "type.apartment",
      رياض: "type.riad",
      استوديو: "type.studio",
    };
    return map[type] ?? type;
  };

  const typeInfo = typeBadge[house.type] || typeBadge.شقة;

  return (
    <button
      onClick={onClick}
      className="group relative flex w-full shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-card text-right shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] content-visibility-auto transform-gpu"
      style={{ width: compact ? 280 : "100%" }}
    >
      <div className="relative h-48 w-full overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${typeInfo.bg}`} />
        {house.images && house.images.length > 0 && (
          <img
            src={house.images[0]}
            alt={house.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-110 transform-gpu will-change-transform"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        <div
          onClick={(e) => {
            e.stopPropagation();
            toggle(house.id);
          }}
          className="absolute left-3 top-3 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-lg backdrop-blur-sm transition active:scale-90 hover:bg-white"
          aria-label={has(house.id) ? "Remove from favorites" : "Add to favorites"}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
              toggle(house.id);
            }
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill={has(house.id) ? "oklch(0.6 0.22 25)" : "none"}
            stroke={has(house.id) ? "oklch(0.6 0.22 25)" : "currentColor"}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </div>

        <div className="absolute right-3 top-3 rounded-full bg-gradient-to-br from-white/95 to-white/80 px-3 py-1 text-xs font-bold text-foreground shadow-sm backdrop-blur-sm">
          {house.type}
        </div>

        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <svg className="h-3 w-3 fill-amber-400" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>{house.rating}</span>
        </div>

        <div className="absolute bottom-3 left-3 rounded-lg bg-black/30 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {t(typeKey(house.type))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-sm font-bold text-foreground">{house.title}</h3>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <svg
            className="h-3.5 w-3.5 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          <span className="truncate">{house.city}</span>
        </div>

        <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 9V6a2 2 0 012-2h4M22 9V6a2 2 0 00-2-2h-4M2 14v3a2 2 0 002 2h16a2 2 0 002-2v-3M2 14h20" />
            </svg>
            <span>{house.bedrooms}</span>
          </span>
          <span className="h-3 w-px bg-border/60" />
          <span>
            {house.area} {t("card.area")}
          </span>
          <span className="h-3 w-px bg-border/60" />
          <span className="flex items-center gap-1">
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span>{house.bathrooms}</span>
          </span>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-3">
          <div className="flex items-baseline gap-0.5">
            <span className="text-lg font-extrabold text-primary">
              {formatPrice(house.price, currency, locale)}
            </span>
            <span className="text-xs font-medium text-muted-foreground">/{t("card.month")}</span>
          </div>
          <div className="rounded-xl bg-gradient-to-l from-primary to-primary-glow px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm transition-all group-hover:shadow-md group-hover:scale-105">
            {t("card.view")}
          </div>
        </div>
      </div>
    </button>
  );
});
