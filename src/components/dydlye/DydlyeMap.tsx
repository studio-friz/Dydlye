import { memo, useEffect, useRef, useState, useCallback } from "react";
import { Geolocation } from "@capacitor/geolocation";
import type * as LeafletNS from "leaflet";
import type { House } from "@/data/houses";
import type { Destination, DestinationCategory } from "@/data/destinations";
import { useSettings, convertPrice } from "@/i18n/useTranslation";
import { currencySymbols } from "@/i18n/translations";
import Supercluster from "supercluster";
import "maplibre-gl/dist/maplibre-gl.css";
import { createOfflineGlLayer } from "@/lib/offlineMap";

type MapItem = House | Destination;

interface Props {
  houses: House[];
  destinations?: Destination[];
  selectedId: string | null;
  directionsToId?: string | null;
  onSelect: (id: string) => void;
  mode?: "houses" | "destinations";
  tripRoute?: { lat: number; lng: number }[];
  completedCount?: number;
  showFullRoute?: boolean;
}

const destColors: Record<DestinationCategory, string> = {
  مسبح: "#0ea5e9",
  "معلم سياحي": "#f59e0b",
  مقهى: "#92400e",
  مطعم: "#e11d48",
  حفلة: "#d946ef",
  تسوق: "#8b5cf6",
  طبيعة: "#10b981",
  ترفيه: "#3b82f6",
  شاطئ: "#eab308",
  رياضة: "#84cc16",
  "حمام تقليدي": "#a8a29e",
};

function isDestination(item: MapItem): item is Destination {
  return "category" in item && "name" in item;
}

export type MapLayer = "satellite" | "hybrid" | "streets" | "terrain";

interface TileSource {
  url: string;
  maxNativeZoom: number;
}

interface LayerConfig {
  sources: TileSource[];
  labels?: TileSource[];
  attribution: string;
  badge: string;
}

const ESRI_IMAGERY: TileSource = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  maxNativeZoom: 19,
};

const ESRI_IMAGERY_ALT: TileSource = {
  url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  maxNativeZoom: 19,
};

const ESRI_LABELS: TileSource = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  maxNativeZoom: 19,
};

const S2_CLOUDLESS: TileSource = {
  url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg",
  maxNativeZoom: 18,
};

const ESRI_STREET: TileSource = {
  url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  maxNativeZoom: 19,
};

const ESRI_STREET_ALT: TileSource = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  maxNativeZoom: 19,
};

const ESRI_TERRAIN: TileSource = {
  url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  maxNativeZoom: 19,
};

const ESRI_TERRAIN_ALT: TileSource = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  maxNativeZoom: 19,
};

const OSM_STANDARD: TileSource = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxNativeZoom: 18,
};

const IMAGERY_ATTRIBUTION = "© Esri, Maxar, Earthstar Geographics, GIS User Community";
const VECTOR_ATTRIBUTION = "© Esri, HERE, Garmin, © OpenStreetMap contributors";

const LAYER_CONFIG: Record<MapLayer, LayerConfig> = {
  satellite: {
    sources: [ESRI_IMAGERY, ESRI_IMAGERY_ALT, S2_CLOUDLESS],
    attribution: IMAGERY_ATTRIBUTION,
    badge: "© Esri, Maxar",
  },
  hybrid: {
    sources: [ESRI_IMAGERY, ESRI_IMAGERY_ALT, S2_CLOUDLESS],
    labels: [ESRI_LABELS],
    attribution: `${IMAGERY_ATTRIBUTION} · © OpenStreetMap contributors`,
    badge: "© Esri, Maxar",
  },
  streets: {
    sources: [ESRI_STREET, ESRI_STREET_ALT, OSM_STANDARD],
    attribution: VECTOR_ATTRIBUTION,
    badge: "© Esri, OSM",
  },
  terrain: {
    sources: [ESRI_TERRAIN, ESRI_TERRAIN_ALT, OSM_STANDARD],
    attribution: VECTOR_ATTRIBUTION,
    badge: "© Esri, OSM",
  },
};

const SOURCE_FAILOVER_THRESHOLD = 6;

function borderStyleForLayer(layer: MapLayer): LeafletNS.PathOptions {
  return layer === "streets" || layer === "terrain"
    ? { color: "rgba(0,0,0,0.4)", weight: 1, fill: false }
    : { color: "rgba(255,255,255,0.55)", weight: 1.2, fill: false };
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestRoutePoint(
  lat: number,
  lng: number,
  coords: [number, number][],
): { index: number; distance: number } {
  let index = 0;
  let distance = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const [clat, clng] = coords[i];
    const d = haversine(lat, lng, clat, clng);
    if (d < distance) {
      distance = d;
      index = i;
    }
  }
  return { index, distance };
}

export const DydlyeMap = memo(function DydlyeMap({
  houses,
  destinations = [],
  selectedId,
  directionsToId,
  onSelect,
  mode = "houses",
  tripRoute,
  completedCount = 0,
  showFullRoute = false,
}: Props) {
  const { t, currency, locale } = useSettings();
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const markersRef = useRef<Map<string, LeafletNS.Marker>>(new Map());
  const clusterMarkersRef = useRef<Map<number, LeafletNS.Marker>>(new Map());
  const routeLayerRef = useRef<LeafletNS.Polyline | null>(null);
  const tripSegmentLayersRef = useRef<Map<string, LeafletNS.Polyline>>(new Map());
  const [ready, setReady] = useState(false);
  const [layer, setLayer] = useState<MapLayer>("satellite");
  const baseLayerRef = useRef<LeafletNS.TileLayer | null>(null);
  const labelsLayerRef = useRef<LeafletNS.TileLayer | null>(null);
  const bordersLayerRef = useRef<LeafletNS.GeoJSON | null>(null);
  const offlineLayerRef = useRef<LeafletNS.Layer | null>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [onlineTick, setOnlineTick] = useState(() => navigator.onLine);
  const [sourceTick, setSourceTick] = useState(0);
  const sourceIndexRef = useRef<Record<MapLayer, number>>({
    satellite: 0,
    hybrid: 0,
    streets: 0,
    terrain: 0,
  });
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const superclusterRef = useRef<Supercluster | null>(null);
  const itemsRef = useRef<MapItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const currencyRef = useRef(currency);
  const localeRef = useRef(locale);
  const onSelectRef = useRef(onSelect);
  const modeRef = useRef(mode);

  itemsRef.current = mode === "houses" ? houses : destinations;
  selectedIdRef.current = selectedId;
  currencyRef.current = currency;
  localeRef.current = locale;
  onSelectRef.current = onSelect;
  modeRef.current = mode;

  const renderMarkers = useCallback(() => {
    const map = leafletRef.current;
    const L = LRef.current;
    const index = superclusterRef.current;
    if (!map || !L || !index) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();
    clusterMarkersRef.current.forEach((m) => m.remove());
    clusterMarkersRef.current.clear();

    const bounds = map.getBounds();
    const bbox: [number, number, number, number] = [
      bounds.getWest(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getNorth(),
    ];
    const zoom = Math.round(map.getZoom());
    const clusters = index.getClusters(bbox, zoom);
    const curSelected = selectedIdRef.current;
    const curCurrency = currencyRef.current;
    const curLocale = localeRef.current;
    const curMode = modeRef.current;
    const curItems = itemsRef.current;
    const curOnSelect = onSelectRef.current;

    clusters.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;

      if (feature.properties.cluster) {
        const count = feature.properties.point_count;
        const clusterId = feature.properties.cluster_id;
        const size = count < 10 ? "small" : count < 50 ? "medium" : "large";

        const icon = L.divIcon({
          html: `<div class="dydlye-cluster dydlye-cluster-${size}"><span>${count}</span></div>`,
          className: "dydlye-cluster-icon",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });

        const m = L.marker([lat, lng], { icon }).addTo(map);
        m.on("click", () => {
          const expansionZoom = index.getClusterExpansionZoom(clusterId);
          map.flyTo([lat, lng], expansionZoom, { duration: 0.5 });
        });
        clusterMarkersRef.current.set(clusterId, m);
        return;
      }

      const item = curItems.find((it) => it.id === feature.properties.id);
      if (!item) return;

      const active = item.id === curSelected;
      const isDest = isDestination(item);

      let html: string;
      if (isDest) {
        const color = destColors[item.category] || "#3b82f6";
        html = `
          <div class="dydlye-pin ${active ? "dydlye-pin-active" : ""}" style="--pin-color: ${color}">
            <div class="dydlye-pin-body" style="background: ${color}; color: white;">
              <span class="dydlye-pin-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="10" r="3"/>
                  <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"/>
                </svg>
              </span>
              <span>${item.name.length > 12 ? item.name.slice(0, 12) + "…" : item.name}</span>
            </div>
            <div class="dydlye-pin-tip" style="border-top-color: ${color};"></div>
          </div>
        `;
      } else {
        const h = item as House;
        html = `
          <div class="dydlye-pin ${active ? "dydlye-pin-active" : ""}">
            <div class="dydlye-pin-body">
              <span class="dydlye-pin-icon">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </span>
              <span>${convertPrice(h.price, curCurrency).toLocaleString(curLocale, { maximumFractionDigits: curCurrency === "MAD" ? 0 : 2 })} ${currencySymbols[curCurrency]}</span>
            </div>
            <div class="dydlye-pin-tip"></div>
          </div>
        `;
      }

      const icon = L.divIcon({
        html,
        iconSize: [60, 40],
        iconAnchor: [30, 40],
        className: "dydlye-marker",
      });

      const m = L.marker([lat, lng], { icon }).addTo(map);
      m.on("click", () => curOnSelect(item.id));
      markersRef.current.set(item.id, m);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L =
        (mod as unknown as { default: typeof LeafletNS }).default ??
        (mod as unknown as typeof LeafletNS);
      if (cancelled || !mapRef.current || leafletRef.current) return;
      LRef.current = L;
      const map = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
        maxZoom: 20,
        minZoom: 2,
        maxBounds: L.latLngBounds([-85, -180], [85, 180]),
        maxBoundsViscosity: 1.0,
      }).setView([20.0, 20.0], 3);
      leafletRef.current = map;
      setReady(true);
      setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 100);
    })();
    return () => {
      cancelled = true;
      leafletRef.current?.remove();
      leafletRef.current = null;
    };
  }, []);

  const ensureBorders = useCallback(() => {
    const map = leafletRef.current;
    const L = LRef.current;
    if (!map || !L || bordersLayerRef.current) return;
    void fetch("/borders/worldCountries.geojson")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to fetch borders (${res.status})`);
        return res.json();
      })
      .then((data) => {
        if (!leafletRef.current || !LRef.current || bordersLayerRef.current) return;
        bordersLayerRef.current = LRef.current
          .geoJSON(data, {
            style: borderStyleForLayer(layerRef.current),
            interactive: false,
          })
          .addTo(leafletRef.current);
      })
      .catch((err) => {
        console.error("Borders layer error:", err);
      });
  }, []);

  useEffect(() => {
    const map = leafletRef.current;
    const L = LRef.current;
    if (!map || !L || !ready) return;

    baseLayerRef.current?.remove();
    labelsLayerRef.current?.remove();
    baseLayerRef.current = null;
    labelsLayerRef.current = null;

    if (!navigator.onLine) return;

    const cfg = LAYER_CONFIG[layer];
    const index = sourceIndexRef.current[layer];
    const source = cfg.sources[Math.min(index, cfg.sources.length - 1)];

    const base = L.tileLayer(source.url, {
      attribution: cfg.attribution,
      maxZoom: 20,
      maxNativeZoom: source.maxNativeZoom,
      minZoom: 2,
    });
    baseLayerRef.current = base.addTo(map);

    let loaded = 0;
    let errored = 0;
    const onLoad = () => {
      loaded += 1;
    };
    const onError = () => {
      errored += 1;
      if (loaded === 0 && errored >= SOURCE_FAILOVER_THRESHOLD && index < cfg.sources.length - 1) {
        sourceIndexRef.current[layer] = index + 1;
        setSourceTick((tick) => tick + 1);
      }
    };
    base.on("tileload", onLoad);
    base.on("tileerror", onError);

    if (cfg.labels) {
      labelsLayerRef.current = L.tileLayer(cfg.labels[0].url, {
        attribution: cfg.attribution,
        maxZoom: 20,
        maxNativeZoom: cfg.labels[0].maxNativeZoom,
        minZoom: 2,
        pane: "overlayPane",
        opacity: layer === "hybrid" ? 1 : 0.75,
      }).addTo(map);
    }

    bordersLayerRef.current?.setStyle(borderStyleForLayer(layer));

    return () => {
      base.off("tileload", onLoad);
      base.off("tileerror", onError);
    };
  }, [layer, ready, onlineTick, sourceTick]);

  // راقب حالة الاتصال لتشغيل/إيقاف الخريطة المدمجة
  useEffect(() => {
    const apply = () => {
      if (navigator.onLine) {
        sourceIndexRef.current = { satellite: 0, hybrid: 0, streets: 0, terrain: 0 };
      }
      setOnlineTick(navigator.onLine);
    };
    window.addEventListener("online", apply);
    window.addEventListener("offline", apply);
    return () => {
      window.removeEventListener("online", apply);
      window.removeEventListener("offline", apply);
    };
  }, []);

  useEffect(() => {
    const map = leafletRef.current;
    if (!map || !ready) return;
    const offline = !navigator.onLine;

    offlineLayerRef.current?.remove();
    offlineLayerRef.current = null;

    if (!offline) {
      setOfflineMode(false);
      ensureBorders();
      return;
    }

    baseLayerRef.current?.remove();
    labelsLayerRef.current?.remove();
    bordersLayerRef.current?.remove();
    bordersLayerRef.current = null;

    try {
      offlineLayerRef.current = createOfflineGlLayer(localeRef.current);
      offlineLayerRef.current.addTo(map);
      setOfflineMode(true);
    } catch (err) {
      console.error("Offline map error:", err);
    }
  }, [ready, onlineTick, ensureBorders]);

  const items: MapItem[] = mode === "houses" ? houses : destinations;

  // Rebuild supercluster index when items change
  useEffect(() => {
    const map = leafletRef.current;
    if (!map || !ready) return;

    const points: Supercluster.PointFeature<{ id: string }>[] = items.map((item) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [item.lng, item.lat] },
      properties: { id: item.id },
    }));

    const index = new Supercluster({
      radius: 60,
      maxZoom: 16,
      minZoom: 2,
    });
    index.load(points);
    superclusterRef.current = index;

    if (items.length > 0) {
      const bounds = map.getBounds();
      const zoom = Math.round(map.getZoom());
      const clusters = index.getClusters(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        zoom,
      );
      if (clusters.length === 0) {
        const allBounds = LRef.current!.latLngBounds(
          items.map((it) => [it.lat, it.lng] as [number, number]),
        );
        map.fitBounds(allBounds, { padding: [80, 60], maxZoom: 12 });
      }
    }

    renderMarkers();
  }, [items, ready, renderMarkers]);

  // Listen to map move/zoom for re-clustering
  useEffect(() => {
    const map = leafletRef.current;
    if (!map || !ready || !superclusterRef.current) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleMove = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(renderMarkers, 80);
    };
    map.on("moveend", handleMove);
    map.on("zoomend", handleMove);
    return () => {
      map.off("moveend", handleMove);
      map.off("zoomend", handleMove);
      if (timer) clearTimeout(timer);
    };
  }, [ready, renderMarkers]);

  // Re-render when selectedId changes (to update active state)
  useEffect(() => {
    if (!ready) return;
    renderMarkers();
  }, [selectedId, ready, renderMarkers]);

  // Re-render when currency/locale changes (price display)
  useEffect(() => {
    if (!ready) return;
    renderMarkers();
  }, [currency, locale, ready, renderMarkers]);

  useEffect(() => {
    const map = leafletRef.current;
    if (!map || selectedId == null) return;
    const item = items.find((it) => it.id === selectedId);
    if (item) map.flyTo([item.lat, item.lng], 13, { duration: 0.8 });
  }, [selectedId, items]);

  const userMarkerRef = useRef<LeafletNS.Marker | null>(null);
  const userCircleRef = useRef<LeafletNS.Circle | null>(null);
  const watchIdRef = useRef<string | number | null>(null);
  const watchNativeRef = useRef(false);
  const routeCoordsRef = useRef<[number, number][] | null>(null);
  const destinationRef = useRef<{ lat: number; lng: number } | null>(null);
  const navigationActiveRef = useRef(false);
  const routeFetchingRef = useRef(false);
  const followRef = useRef(true);
  const [locating, setLocating] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [following, setFollowing] = useState(false);
  const livePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveTracking, setLiveTracking] = useState(false);

  const isNativePlatform = () => {
    if (typeof window === "undefined") return false;
    return !!(
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.();
  };

  const updateUserMarker = useCallback(
    (
      map: LeafletNS.Map,
      L: typeof LeafletNS,
      latitude: number,
      longitude: number,
      accuracy: number,
    ) => {
      if (!userMarkerRef.current) {
        const icon = L.divIcon({
          html: `<div class="dydlye-user-dot"><div class="dydlye-user-pulse"></div></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
          className: "dydlye-user-marker",
        });
        userMarkerRef.current = L.marker([latitude, longitude], { icon, zIndexOffset: 1000 }).addTo(
          map,
        );
      } else {
        userMarkerRef.current.setLatLng([latitude, longitude]);
      }
      if (!userCircleRef.current) {
        userCircleRef.current = L.circle([latitude, longitude], {
          radius: Math.max(accuracy, 15),
          color: "var(--color-primary)",
          fillColor: "var(--color-primary)",
          fillOpacity: 0.12,
          weight: 1.5,
        }).addTo(map);
      } else {
        userCircleRef.current.setLatLng([latitude, longitude]);
        userCircleRef.current.setRadius(Math.max(accuracy, 15));
      }
    },
    [],
  );

  const fetchRoute = useCallback(
    async (fromLat: number, fromLng: number, dest: { lat: number; lng: number }) => {
      const map = leafletRef.current;
      const L = LRef.current;
      if (!map || !L || routeFetchingRef.current || !navigationActiveRef.current) return;
      routeFetchingRef.current = true;
      setLocating(true);
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`,
        );
        const data = await response.json();
        if (data.code === "Ok" && data.routes?.[0]) {
          const coords = data.routes[0].geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number],
          );
          routeCoordsRef.current = coords;
          if (!routeLayerRef.current) {
            routeLayerRef.current = L.polyline([], {
              color: "var(--color-primary)",
              weight: 5,
              opacity: 0.8,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
          }
          routeLayerRef.current.setLatLngs([[fromLat, fromLng], ...coords]);
          if (navigationActiveRef.current) {
            const bounds = L.latLngBounds([
              [fromLat, fromLng],
              [dest.lat, dest.lng],
            ]);
            map.fitBounds(bounds, { padding: [100, 100], maxZoom: 15 });
          }
        }
      } catch (error) {
        console.error("Routing error:", error);
      } finally {
        routeFetchingRef.current = false;
        setLocating(false);
      }
    },
    [],
  );

  const handleNavigationUpdate = useCallback(
    (latitude: number, longitude: number) => {
      if (!navigationActiveRef.current) return;
      const dest = destinationRef.current;
      const route = routeCoordsRef.current;
      if (!dest) return;
      if (!route || route.length < 2) {
        void fetchRoute(latitude, longitude, dest);
        return;
      }
      const { index, distance } = nearestRoutePoint(latitude, longitude, route);
      if (distance > 150) {
        void fetchRoute(latitude, longitude, dest);
        return;
      }
      const next = [[latitude, longitude], ...route.slice(index)] as [number, number][];
      routeLayerRef.current?.setLatLngs(next);
    },
    [fetchRoute],
  );

  const stopTracking = useCallback(() => {
    if (livePollRef.current != null) {
      clearInterval(livePollRef.current);
      livePollRef.current = null;
      setLiveTracking(false);
    }
    const id = watchIdRef.current;
    if (id == null) {
      followRef.current = false;
      setFollowing(false);
      setTracking(false);
      return;
    }
    if (watchNativeRef.current) {
      void Geolocation.clearWatch({ id: String(id) }).catch(() => {});
    } else {
      navigator.geolocation.clearWatch(id as number);
    }
    watchIdRef.current = null;
    watchNativeRef.current = false;
    followRef.current = false;
    setTracking(false);
    setFollowing(false);
  }, []);

  const startTracking = useCallback(() => {
    const map = leafletRef.current;
    const L = LRef.current;
    if (!map || !L || watchIdRef.current != null) return;
    if (!("geolocation" in navigator)) return;
    if (livePollRef.current != null) {
      clearInterval(livePollRef.current);
      livePollRef.current = null;
      setLiveTracking(false);
    }

    const handlePosition = (latitude: number, longitude: number, accuracy: number) => {
      updateUserMarker(map, L, latitude, longitude, accuracy);
      handleNavigationUpdate(latitude, longitude);
      setLocating(false);
      if (followRef.current) {
        map.panTo([latitude, longitude]);
      }
    };

    const handleWatchError = (err: { code?: number; message?: string } | null) => {
      setLocating(false);
      if (navigationActiveRef.current && err?.code !== 1) {
        return;
      }
      stopTracking();
      if (!navigationActiveRef.current) {
        const msg =
          err?.code === 1
            ? t("map.locationDenied")
            : err?.code === 2
              ? t("map.locationUnavailable")
              : t("map.locationTimeout");
        alert(msg);
      }
    };

    const startNavigatorWatch = () => {
      const id = navigator.geolocation.watchPosition(
        (pos) =>
          handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? 15),
        (err) => handleWatchError(err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
      watchIdRef.current = id;
      watchNativeRef.current = false;
      setTracking(true);
    };

    if (isNativePlatform()) {
      Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        (pos, err) => {
          if (err) {
            handleWatchError(err);
            return;
          }
          if (pos)
            handlePosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy ?? 15);
        },
      )
        .then((id) => {
          watchIdRef.current = id;
          watchNativeRef.current = true;
          setTracking(true);
        })
        .catch(() => {
          startNavigatorWatch();
        });
    } else {
      startNavigatorWatch();
    }
  }, [updateUserMarker, handleNavigationUpdate, stopTracking, t]);

  const stopLiveTracking = useCallback(() => {
    if (livePollRef.current != null) {
      clearInterval(livePollRef.current);
      livePollRef.current = null;
    }
    followRef.current = false;
    setLiveTracking(false);
    setFollowing(false);
  }, []);

  const getPositionOnce = useCallback(async () => {
    if (isNativePlatform()) {
      const res = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      });
      return res.coords;
    }
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0,
      }),
    );
    return pos.coords;
  }, []);

  const startLiveTracking = useCallback(async () => {
    const map = leafletRef.current;
    const L = LRef.current;
    if (!map || !L || !("geolocation" in navigator)) {
      alert(t("map.noGeolocation"));
      return;
    }
    if (livePollRef.current != null) {
      stopLiveTracking();
      return;
    }
    if (watchIdRef.current != null) stopTracking();

    followRef.current = true;
    setFollowing(true);
    setLiveTracking(true);

    const poll = async () => {
      try {
        const coords = await getPositionOnce();
        updateUserMarker(map, L, coords.latitude, coords.longitude, coords.accuracy ?? 15);
        handleNavigationUpdate(coords.latitude, coords.longitude);
        if (followRef.current) {
          map.panTo([coords.latitude, coords.longitude]);
        }
      } catch (err) {
        const e = err as { code?: number; message?: string };
        if (e?.code === 1 || e?.code === 2) {
          stopLiveTracking();
          setTracking(false);
          alert(
            e?.code === 1
              ? t("map.locationDenied")
              : e?.code === 2
                ? t("map.locationUnavailable")
                : t("map.locationTimeout"),
          );
          throw err;
        }
      }
    };

    try {
      await poll();
    } catch {
      return;
    }
    livePollRef.current = setInterval(poll, 500);
  }, [
    getPositionOnce,
    stopLiveTracking,
    stopTracking,
    t,
    updateUserMarker,
    handleNavigationUpdate,
  ]);

  useEffect(() => {
    const map = leafletRef.current;
    const L = LRef.current;
    if (!map || !L || !ready) return;

    if (directionsToId == null) {
      navigationActiveRef.current = false;
      destinationRef.current = null;
      routeLayerRef.current?.remove();
      routeLayerRef.current = null;
      routeCoordsRef.current = null;
      stopTracking();
      return;
    }

    const item = items.find((it) => it.id === directionsToId);
    if (!item) return;

    navigationActiveRef.current = true;
    destinationRef.current = { lat: item.lat, lng: item.lng };
    followRef.current = true;
    setFollowing(true);
    setLocating(true);
    startTracking();

    return () => {
      navigationActiveRef.current = false;
      destinationRef.current = null;
      routeLayerRef.current?.remove();
      routeLayerRef.current = null;
      routeCoordsRef.current = null;
      stopTracking();
    };
  }, [directionsToId, items, ready, startTracking, stopTracking]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  useEffect(() => {
    const map = leafletRef.current;
    const L = LRef.current;
    if (!map || !L || !ready) return;

    tripSegmentLayersRef.current.forEach((l) => l.remove());
    tripSegmentLayersRef.current.clear();

    if (!tripRoute || tripRoute.length < 2) return;

    const segmentColors = [
      "#ef4444",
      "#f59e0b",
      "#10b981",
      "#3b82f6",
      "#8b5cf6",
      "#ec4899",
      "#14b8a6",
      "#f97316",
      "#6366f1",
      "#84cc16",
    ];
    const coords = tripRoute.map((p) => [p.lat, p.lng] as [number, number]);
    const pending: Promise<void>[] = [];
    const maxSegment = showFullRoute
      ? tripRoute.length - 1
      : Math.min(Math.max(completedCount - 1, 0), tripRoute.length - 1);

    for (let i = 0; i < maxSegment; i++) {
      const from = tripRoute[i];
      const to = tripRoute[i + 1];
      const segmentKey = `${from.lat},${from.lng}-${to.lat},${to.lng}`;
      const color = segmentColors[i % segmentColors.length];

      const p = fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`,
      )
        .then((r) => r.json())
        .then((data) => {
          if (data.code === "Ok" && data.routes?.[0]) {
            const line = data.routes[0].geometry.coordinates.map((c: [number, number]) => [
              c[1],
              c[0],
            ]);
            const polyline = L.polyline(line, {
              color,
              weight: 4,
              opacity: 0.8,
              lineCap: "round",
              lineJoin: "round",
            }).addTo(map);
            tripSegmentLayersRef.current.set(segmentKey, polyline);
          }
        })
        .catch(() => {});

      pending.push(p);
    }

    if (pending.length > 0) {
      Promise.all(pending).then(() => {
        const shown = coords.slice(0, maxSegment + 1);
        const bounds = L.latLngBounds(shown);
        map.fitBounds(bounds, { padding: [80, 80], maxZoom: 12 });
      });
    }
  }, [tripRoute, completedCount, showFullRoute, ready]);

  const goToMyLocation = () => {
    const map = leafletRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (!("geolocation" in navigator)) {
      alert(t("map.noGeolocation"));
      return;
    }

    if (livePollRef.current != null) {
      stopLiveTracking();
      return;
    }

    if (navigationActiveRef.current) {
      followRef.current = !followRef.current;
      setFollowing(followRef.current);
      if (followRef.current && userMarkerRef.current) {
        map.panTo(userMarkerRef.current.getLatLng());
      }
      return;
    }

    if (watchIdRef.current != null) {
      stopTracking();
      return;
    }

    followRef.current = true;
    setFollowing(true);
    setLocating(true);
    startTracking();
  };

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" style={{ willChange: "transform" }} />
      <button
        onClick={goToMyLocation}
        disabled={locating}
        aria-label={t("map.myLocation")}
        className={`absolute bottom-6 left-4 z-[400] flex h-12 w-12 items-center justify-center rounded-full shadow-lg backdrop-blur-md transition active:scale-95 disabled:opacity-70 ${
          tracking && following
            ? "bg-primary text-white shadow-primary-glow"
            : "bg-surface-elevated/95 text-primary"
        }`}
      >
        {locating ? (
          <svg
            className="h-5 w-5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        )}
      </button>
      <button
        onClick={() => setShowLayerMenu((s) => !s)}
        aria-label={t("map.switchLayer")}
        aria-expanded={showLayerMenu}
        className="absolute bottom-20 left-4 z-[500] flex h-12 items-center gap-1.5 rounded-full bg-surface-elevated/95 px-3.5 text-xs font-semibold text-primary shadow-lg backdrop-blur-md transition active:scale-95"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
          <line x1="8" y1="2" x2="8" y2="18" />
          <line x1="16" y1="6" x2="16" y2="22" />
        </svg>
        <span>{t(`map.${layer}`)}</span>
      </button>
      {showLayerMenu && (
        <div className="absolute bottom-[7.5rem] left-4 z-[500] flex flex-col overflow-hidden rounded-2xl bg-surface-elevated/95 shadow-lg backdrop-blur-md">
          {(Object.keys(LAYER_CONFIG) as MapLayer[]).map((l) => (
            <button
              key={l}
              onClick={() => {
                sourceIndexRef.current[l] = 0;
                setLayer(l);
                setShowLayerMenu(false);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition hover:bg-primary/10 ${
                layer === l ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {layer === l && (
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              <span className={layer === l ? "" : "pl-5"}>{t(`map.${l}`)}</span>
            </button>
          ))}
        </div>
      )}
      {offlineMode ? (
        <span className="pointer-events-none absolute bottom-1 right-2 z-[400] flex items-center gap-1 rounded bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
          {t("map.offline")}
        </span>
      ) : (
        <span className="pointer-events-none absolute bottom-1 right-2 z-[400] rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/85">
          {LAYER_CONFIG[layer].badge}
        </span>
      )}
    </div>
  );
});
