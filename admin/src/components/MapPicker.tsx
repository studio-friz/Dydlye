import { useEffect, useRef } from "react";
import L from "leaflet";

interface MapPickerProps {
  lat: number | null;
  lng: number | null;
  onPick: (lat: number, lng: number) => void;
  height?: number;
}

export function MapPicker({ lat, lng, onPick, height = 320 }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(lat != null && lng != null ? [lat, lng] : [31.7917, -7.0926], 6);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 20,
      maxNativeZoom: 19,
    }).addTo(map);

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: lat2, lng: lng2 } = e.latlng;
      setMarker(lat2, lng2);
      onPick(lat2, lng2);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lat != null && lng != null && mapRef.current) {
      setMarker(lat, lng);
    }
  }, [lat, lng]);

  function setMarker(lat2: number, lng2: number) {
    const map = mapRef.current;
    if (!map) return;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat2, lng2]).addTo(map);
    } else {
      markerRef.current.setLatLng([lat2, lng2]);
    }
  }

  return (
    <div>
      <div
        ref={containerRef}
        style={{ height }}
        className="w-full rounded-2xl border border-border"
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        انقر على الخريطة لتحديد الموقع
        {lat != null && lng != null && (
          <span className="font-mono">
            {" "}
            — {lat.toFixed(5)}, {lng.toFixed(5)}
          </span>
        )}
      </p>
    </div>
  );
}
