import { createFileRoute } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  lazy,
  Suspense,
  memo,
  useDeferredValue,
} from "react";
import { useProperties } from "@/hooks/useProperties";
import { useDestinations } from "@/hooks/useDestinations";
import { useFavorites } from "@/hooks/useFavorites";
import { HouseDetailSheet } from "@/components/dydlye/HouseDetailSheet";
import { DestinationDetailSheet } from "@/components/dydlye/DestinationDetailSheet";
import { TripStrip } from "@/components/dydlye/TripStrip";
import { TripCompleteCelebration } from "@/components/dydlye/TripCompleteCelebration";
import { AppShell } from "@/components/dydlye/AppShell";
import { useSettings } from "@/i18n/useTranslation";
import { getMode, onModeChange, setMode } from "@/lib/destinationMode";
import {
  isFavoritesFilterActive,
  setFavoritesFilter,
  onFavoritesFilterChange,
} from "@/lib/favoritesFilter";
import { getTrip, onTripChange } from "@/lib/tripPlanner";
import type { TripItem } from "@/lib/tripPlanner";
import type { DestinationCategory } from "@/data/destinations";

const DydlyeMap = lazy(() =>
  import("@/components/dydlye/DydlyeMap").then((m) => ({ default: m.DydlyeMap })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dydlye - العثور على سكنك المثالي" },
      { name: "description", content: "اكتشف سكنك المثالي مع تطبيق Dydlye." },
      { property: "og:title", content: "Dydlye - العثور على سكنك المثالي" },
      { property: "og:description", content: "Discover Your Destination, Live Your Experience" },
    ],
  }),
  component: DydlyeHome,
});

const houseTypeValues = ["الكل", "فيلا", "شقة", "رياض", "استوديو"] as const;

const destCategoryValues: (DestinationCategory | "الكل")[] = [
  "الكل",
  "شاطئ",
  "معلم سياحي",
  "طبيعة",
  "مسبح",
  "رياضة",
  "حمام تقليدي",
  "ترفيه",
  "مطعم",
  "مقهى",
  "تسوق",
  "حفلة",
];

function DydlyeHome() {
  const { properties: allHouses, loading: housesLoading, updateProperty } = useProperties();
  const { destinations: allDestinations, loading: destsLoading } = useDestinations();
  const { ids: favoriteIds, has: isFavorite } = useFavorites();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeFilterIdx, setActiveFilterIdx] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [directionsToId, setDirectionsToId] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [mode, setMode] = useState<"houses" | "destinations">("houses");
  const [trip, setTrip] = useState<TripItem[]>(() => getTrip());
  const [celebrate, setCelebrate] = useState(false);
  const [showFullRoute, setShowFullRoute] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(() => isFavoritesFilterActive());

  useEffect(() => {
    return onFavoritesFilterChange((v) => {
      setShowFavoritesOnly(v);
      setQuery("");
      setActiveFilterIdx(0);
      setSelectedId(null);
      setSheet(false);
    });
  }, []);
  const { t, currency, locale } = useSettings();

  useEffect(() => {
    return onModeChange((m) => {
      setMode(m);
      setQuery("");
      setActiveFilterIdx(0);
      setSelectedId(null);
      setSheet(false);
      setDirectionsToId(null);
    });
  }, []);

  useEffect(() => {
    return onTripChange((t) => setTrip([...t]));
  }, []);

  const tripRoute = useMemo(() => trip.map((t) => ({ lat: t.lat, lng: t.lng })), [trip]);
  const completedCount = useMemo(() => trip.filter((t) => t.completed).length, [trip]);

  const handleTripComplete = useCallback(() => {
    setCelebrate(true);
  }, []);

  const handleCelebrateClose = useCallback(() => {
    setCelebrate(false);
  }, []);

  const houseFilterLabels = useMemo(
    () => [
      t("filter.all"),
      t("filter.villa"),
      t("filter.apartment"),
      t("filter.riad"),
      t("filter.studio"),
    ],
    [t],
  );
  const destFilterLabels = useMemo(
    () => [
      t("dest.all"),
      t("dest.beach"),
      t("dest.landmark"),
      t("dest.nature"),
      t("dest.pool"),
      t("dest.sport"),
      t("dest.hammam"),
      t("dest.entertainment"),
      t("dest.restaurant"),
      t("dest.cafe"),
      t("dest.shopping"),
      t("dest.party"),
    ],
    [t],
  );

  const filteredHouses = useMemo(() => {
    return allHouses.filter((h) => {
      const q = deferredQuery.trim().toLowerCase();
      const matchQ =
        !q ||
        h.title.toLowerCase().includes(q) ||
        h.city.toLowerCase().includes(q) ||
        h.location.toLowerCase().includes(q);
      const activeType = houseTypeValues[activeFilterIdx];
      const matchF = activeType === "الكل" || h.type === activeType;
      const matchFav = !showFavoritesOnly || isFavorite(h.id);
      return matchQ && matchF && matchFav;
    });
  }, [allHouses, deferredQuery, activeFilterIdx, showFavoritesOnly, isFavorite]);

  const filteredDestinations = useMemo(() => {
    return allDestinations.filter((d) => {
      const q = deferredQuery.trim().toLowerCase();
      const matchQ =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.city.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q);
      const activeCat = destCategoryValues[activeFilterIdx];
      const matchF = activeCat === "الكل" || d.category === activeCat;
      return matchQ && matchF;
    });
  }, [allDestinations, deferredQuery, activeFilterIdx]);

  const selectedHouse = useMemo(
    () =>
      selectedId && mode === "houses" ? (allHouses.find((h) => h.id === selectedId) ?? null) : null,
    [allHouses, selectedId, mode],
  );

  const selectedDestination = useMemo(
    () =>
      selectedId && mode === "destinations"
        ? (allDestinations.find((d) => d.id === selectedId) ?? null)
        : null,
    [allDestinations, selectedId, mode],
  );

  const loading = mode === "houses" ? housesLoading : destsLoading;

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSheet(true);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheet(false);
    setDirectionsToId(null);
  }, []);

  const handleGetDirections = useCallback(() => {
    setDirectionsToId(selectedId);
    setSheet(false);
  }, [selectedId]);

  const handleTripSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSheet(true);
  }, []);

  const handleTripNavigate = useCallback((_lat: number, _lng: number) => {
    setSelectedId(null);
    setSheet(false);
  }, []);

  const handleToggleFullRoute = useCallback(() => {
    setShowFullRoute((v) => !v);
  }, []);

  const currentFilterLabels = useMemo(
    () => (mode === "houses" ? houseFilterLabels : destFilterLabels),
    [mode, houseFilterLabels, destFilterLabels],
  );

  return (
    <>
      <AppShell fullBleed>
        <div className="relative flex h-full w-full flex-col">
          <div className="mob-landscape-search relative z-[450] shrink-0">
            <div className="mob-landscape-search-inner flex w-full flex-col gap-1.5 border-b border-border/40 bg-surface-elevated/95 px-2 pb-2 pt-2 backdrop-blur-xl sm:gap-2 sm:px-3 sm:pb-2.5 sm:pt-2">
              {directionsToId ? (
                <div className="flex items-center justify-between px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {t("search.directions")}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t("search.directionsCalculating")}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDirectionsToId(null)}
                    className="rounded-lg bg-secondary px-3 py-1.5 text-[11px] font-bold text-secondary-foreground"
                  >
                    {t("search.cancel")}
                  </button>
                </div>
              ) : (
                <>
                  {/* Search + Quick Actions Row */}
                  <div className="flex w-full items-center gap-1.5">
                    {/* Search Input */}
                    <div className="flex flex-1 items-center gap-2 rounded-xl bg-secondary/70 px-2.5 py-2 min-w-0">
                      <svg
                        className="h-4 w-4 text-muted-foreground shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path d="M21 21l-4.35-4.35" />
                      </svg>
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={mode === "houses" ? t("search.placeholder") : t("dest.all")}
                        className="flex-1 bg-transparent text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0 sm:text-sm"
                      />
                    </div>

                    {/* Destinations Toggle */}
                    <button
                      onClick={() => {
                        const newMode = mode === "houses" ? "destinations" : "houses";
                        setMode(newMode);
                        setQuery("");
                        setActiveFilterIdx(0);
                        setSelectedId(null);
                        setSheet(false);
                        setDirectionsToId(null);
                      }}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-bold transition-all ${
                        mode === "destinations"
                          ? "bg-teal-500 text-white shadow-sm"
                          : "bg-secondary/70 text-muted-foreground"
                      }`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={mode === "destinations" ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="10" r="3" />
                        <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z" />
                      </svg>
                      <span className="hidden sm:inline">{t("dest.btn")}</span>
                    </button>

                    {/* Favorites */}
                    <button
                      onClick={() => {
                        setFavoritesFilter(!showFavoritesOnly);
                      }}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-2 text-[11px] font-bold transition-all ${
                        showFavoritesOnly
                          ? "bg-red-500 text-white shadow-sm"
                          : "bg-secondary/70 text-muted-foreground"
                      }`}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={showFavoritesOnly ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={showFavoritesOnly ? "animate-heartbeat" : ""}
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                      </svg>
                      <span className="hidden sm:inline">{t("nav.favorites")}</span>
                    </button>
                  </div>

                  {/* Filter Chips */}
                  <FilterChips
                    labels={currentFilterLabels}
                    activeIdx={activeFilterIdx}
                    mode={mode}
                    onSelect={setActiveFilterIdx}
                  />
                </>
              )}
            </div>
          </div>

          <div className="relative flex-1">
            {loading && (
              <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/50 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                  <span className="text-sm font-semibold text-foreground">{t("map.loading")}</span>
                </div>
              </div>
            )}
            <Suspense
              fallback={
                <div className="absolute inset-0 z-[500] flex items-center justify-center bg-background/50 backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                    <span className="text-sm font-semibold text-foreground">
                      {t("map.loading")}
                    </span>
                  </div>
                </div>
              }
            >
              <DydlyeMap
                houses={filteredHouses}
                destinations={filteredDestinations}
                selectedId={selectedId}
                directionsToId={directionsToId}
                onSelect={handleSelect}
                mode={mode}
                tripRoute={trip.length > 1 ? tripRoute : undefined}
                completedCount={completedCount}
                showFullRoute={showFullRoute}
              />
            </Suspense>
          </div>

          {sheet && mode === "houses" && selectedHouse && (
            <HouseDetailSheet
              house={selectedHouse}
              onClose={handleCloseSheet}
              onGetDirections={handleGetDirections}
              onRatingUpdated={(rating, reviews) => {
                if (selectedId) updateProperty(selectedId, { rating, reviews });
              }}
            />
          )}

          {sheet && mode === "destinations" && selectedDestination && (
            <DestinationDetailSheet
              destination={selectedDestination}
              onClose={handleCloseSheet}
              onGetDirections={handleGetDirections}
              onTripComplete={handleTripComplete}
            />
          )}
        </div>
      </AppShell>
      {celebrate && <TripCompleteCelebration onClose={handleCelebrateClose} />}
    </>
  );
}

const FilterChips = memo(function FilterChips({
  labels,
  activeIdx,
  mode,
  onSelect,
}: {
  labels: string[];
  activeIdx: number;
  mode: "houses" | "destinations";
  onSelect: (idx: number) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-0.5 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-2">
      {labels.map((label, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`shrink-0 rounded-full px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition ${
            activeIdx === i
              ? mode === "destinations"
                ? "bg-gradient-to-l from-fuchsia-500 to-pink-400 text-white shadow-md"
                : "bg-gradient-to-l from-primary to-primary-glow text-white shadow-md"
              : "bg-secondary text-secondary-foreground hover:bg-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
});
