import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { type House } from "@/data/houses";
import { HouseCard } from "@/components/dydlye/HouseCard";
import { HouseDetailSheet } from "@/components/dydlye/HouseDetailSheet";
import { AppShell } from "@/components/dydlye/AppShell";
import { useFavorites } from "@/hooks/useFavorites";
import { useProperties } from "@/hooks/useProperties";
import { useSettings } from "@/i18n/useTranslation";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "المفضلة - Dydlye" },
      { name: "description", content: "كل العقارات التي حفظتها في مكان واحد." },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { t, currency, locale } = useSettings();
  const { ids } = useFavorites();
  const { properties: allHouses, loading, updateProperty } = useProperties();
  const [selected, setSelected] = useState<House | null>(null);
  const list = useMemo(() => allHouses.filter((h) => ids.includes(h.id)), [ids, allHouses]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        <header className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {t("fav.heading")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("fav.subtitle")}</p>
        </header>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="text-sm font-semibold text-muted-foreground">{t("fav.loading")}</span>
          </div>
        ) : list.length === 0 ? (
          <div className="mx-auto max-w-md rounded-3xl border border-dashed border-border bg-surface-elevated p-10 text-center">
            <div className="text-5xl">💙</div>
            <h2 className="mt-3 text-lg font-bold text-foreground">{t("fav.empty")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("fav.emptyHint")}</p>
            <Link
              to="/ads"
              className="mt-5 inline-flex rounded-full bg-gradient-to-l from-primary to-primary-glow px-5 py-2.5 text-sm font-bold text-white shadow-md"
            >
              {t("fav.browse")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((h) => (
              <div key={h.id} className="relative">
                <HouseCard house={h} onClick={() => setSelected(h)} />
              </div>
            ))}
          </div>
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
