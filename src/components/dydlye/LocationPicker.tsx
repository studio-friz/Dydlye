import { useEffect, useRef, useState } from "react";
import type * as LeafletNS from "leaflet";
import { Geolocation } from "@capacitor/geolocation";
import { toast } from "sonner";
import { useSettings } from "@/i18n/useTranslation";

interface Props {
  onLocationSelect: (lat: number, lng: number, address: string, city?: string) => void;
  initialLat?: number;
  initialLng?: number;
}

export function LocationPicker({ onLocationSelect, initialLat, initialLng }: Props) {
  const { t } = useSettings();
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<LeafletNS.Map | null>(null);
  const LRef = useRef<typeof LeafletNS | null>(null);
  const markerRef = useRef<LeafletNS.Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      const L =
        (mod as unknown as { default: typeof LeafletNS }).default ??
        (mod as unknown as typeof LeafletNS);
      if (cancelled || !mapRef.current || leafletRef.current) return;
      LRef.current = L;

      const initialPos: [number, number] =
        initialLat && initialLng ? [initialLat, initialLng] : [33.5731, -7.5898];

      const map = L.map(mapRef.current, {
        center: initialPos,
        zoom: 13,
        zoomControl: false,
        maxZoom: 18,
        minZoom: 2,
        maxBounds: L.latLngBounds([-85, -180], [85, 180]),
        maxBoundsViscosity: 1.0,
      });

      const STREET_TILES = [
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ];

      let sourceIndex = 0;
      const attachBase = () => {
        const tileLayer = L.tileLayer(STREET_TILES[sourceIndex], {
          attribution: "© Esri, HERE, Garmin, © OpenStreetMap contributors",
          maxZoom: 18,
          maxNativeZoom: 19,
        }).addTo(map);
        if (sourceIndex >= STREET_TILES.length - 1) return;
        let loaded = 0;
        let errored = 0;
        tileLayer.on("tileload", () => {
          loaded += 1;
        });
        tileLayer.on("tileerror", () => {
          errored += 1;
          if (loaded === 0 && errored >= 6) {
            sourceIndex += 1;
            tileLayer.remove();
            attachBase();
          }
        });
      };
      attachBase();

      leafletRef.current = map;
      setReady(true);

      // Add initial marker if exists
      if (initialLat && initialLng) {
        markerRef.current = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);
      }

      map.on("click", async (e: LeafletNS.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        updateMarker(lat, lng);
      });

      setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 100);
    })();

    return () => {
      cancelled = true;
      leafletRef.current?.remove();
    };
  }, []);

  interface GeoAddress {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    province?: string;
    district?: string;
    region?: string;
    state?: string;
  }

  const extractCity = (addr?: GeoAddress | null): string | undefined => {
    return (
      addr?.city ||
      addr?.town ||
      addr?.village ||
      addr?.municipality ||
      addr?.county ||
      addr?.province ||
      addr?.district ||
      addr?.region ||
      addr?.state
    );
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1100));
      }
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`,
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (!data || data.error) continue;
        return { address: data.display_name, city: extractCity(data.address) };
      } catch {
        continue;
      }
    }
    return null;
  };

  const updateMarker = async (lat: number, lng: number) => {
    const L = LRef.current;
    const map = leafletRef.current;
    if (!L || !map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const pos = markerRef.current!.getLatLng();
        updateMarker(pos.lat, pos.lng);
      });
    }

    setLoading(true);
    try {
      const result = await reverseGeocode(lat, lng);
      if (result) {
        onLocationSelect(lat, lng, result.address, result.city);
      } else {
        onLocationSelect(lat, lng, t("location.selected"));
      }
    } catch (err) {
      onLocationSelect(lat, lng, t("location.selected"));
    } finally {
      setLoading(false);
    }
  };

  const goToMyLocation = async () => {
    setLoading(true);
    try {
      const perm = await Geolocation.requestPermissions();
      if (perm.location !== "granted") {
        toast.error(t("map.locationDenied"));
        setLoading(false);
        return;
      }
      const pos = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = pos.coords;
      leafletRef.current?.flyTo([latitude, longitude], 16);
      updateMarker(latitude, longitude);
    } catch {
      toast.error(t("map.locationUnavailable"));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="relative h-[300px] w-full overflow-hidden rounded-2xl border bg-muted shadow-inner">
        <div ref={mapRef} className="h-full w-full" />
        <button
          type="button"
          onClick={goToMyLocation}
          aria-label={t("location.useCurrent")}
          className="absolute bottom-4 left-4 z-[400] flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary shadow-md transition active:scale-95"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
        {loading && (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("location.hint")}</p>
    </div>
  );
}
