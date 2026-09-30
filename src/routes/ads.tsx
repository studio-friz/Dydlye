import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type House } from "@/data/houses";
import { useProperties } from "@/hooks/useProperties";
import { HouseCard } from "@/components/dydlye/HouseCard";
import { HouseDetailSheet } from "@/components/dydlye/HouseDetailSheet";
import { AppShell } from "@/components/dydlye/AppShell";
import { useFavorites } from "@/hooks/useFavorites";
import { useSettings, formatPrice } from "@/i18n/useTranslation";

export const Route = createFileRoute("/ads")({
  head: () => ({
    meta: [
      { title: "العروض القريبة - Dydlye" },
      { name: "description", content: "اكتشف أحدث عروض كراء المنازل القريبة منك في المغرب." },
    ],
  }),
  component: AdsPage,
});

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function AdsPage() {
  const {
    properties: allHouses,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    updateProperty,
  } = useProperties();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMore]);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<House | null>(null);
  const { has, toggle } = useFavorites();
  const { t, dir, currency, locale } = useSettings();

  useEffect(() => {
    if (!("geolocation" in navigator)) return setDenied(true);
    navigator.geolocation.getCurrentPosition(
      (p) => setMe({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setDenied(true),
      { timeout: 6000 },
    );
  }, []);

  const sorted = useMemo(() => {
    if (!me) return allHouses;
    return [...allHouses].sort((a, b) => distanceKm(me, a) - distanceKm(me, b));
  }, [me, allHouses]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
              {t("ads.heading")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {me ? t("ads.sorted") : denied ? t("ads.enableLocation") : t("ads.locating")}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">
            {t("ads.available", String(sorted.length))}
          </span>
        </header>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm font-semibold text-muted-foreground">{t("ads.loading")}</span>
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card p-10 text-center">
            <div className="text-4xl">🔍</div>
            <h2 className="mt-3 text-lg font-bold text-foreground">{t("ads.empty")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("ads.emptyHint")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sorted.map((h) => {
                const km = me ? distanceKm(me, h) : null;
                return (
                  <div key={h.id} className="relative">
                    <HouseCard house={h} onClick={() => setSelected(h)} />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(h.id);
                      }}
                      className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-md backdrop-blur transition active:scale-90"
                      aria-label={t("nav.favorites")}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={has(h.id) ? "oklch(0.6 0.22 25)" : "none"}
                        stroke={has(h.id) ? "oklch(0.6 0.22 25)" : "currentColor"}
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                      </svg>
                    </button>
                    {km != null && (
                      <span className="absolute left-3 top-3 z-10 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
                        {km < 1
                          ? t("ads.meters", String(Math.round(km * 1000)))
                          : t("ads.km", km.toFixed(1))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {loadingMore && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("ads.loading")}
                </span>
              </div>
            )}
            <div ref={sentinelRef} className="h-4" />
          </>
        )}

        {selected && (
          <HouseDetailSheet
            house={selected}
            onClose={() => setSelected(null)}
            onRatingUpdated={(rating, reviews) => updateProperty(selected.id, { rating, reviews })}
          />
        )}
      </div>
    </AppShell>
  );
}
