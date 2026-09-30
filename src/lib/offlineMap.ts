import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";

export type OfflineLang = "ar" | "fr" | "en";

export function offlineLangFromLocale(locale: string): OfflineLang {
  const l = locale.toLowerCase();
  if (l.startsWith("ar")) return "ar";
  if (l.startsWith("fr")) return "fr";
  return "en";
}

const FONTS = {
  ar: ["Noto Sans Arabic Regular"],
  fr: ["Noto Sans Regular"],
  en: ["Noto Sans Regular"],
};

export function buildOfflineStyle(lang: OfflineLang): StyleSpecification {
  const font = FONTS[lang];
  const isArabic = lang === "ar";
  const nameField: ExpressionSpecification = isArabic
    ? ["coalesce", ["get", "name_ar"], ["get", "name"]]
    : ["coalesce", ["get", "name"], ["get", "name_ascii"]];

  return {
    version: 8,
    glyphs: "/offline/fonts/{fontstack}/{range}.pbf",
    sources: {
      admin0: { type: "geojson", data: "/offline/admin0.geojson" },
      admin1: { type: "geojson", data: "/offline/admin1.geojson" },
      places: { type: "geojson", data: "/offline/places.geojson" },
      roads: { type: "geojson", data: "/offline/roads.geojson" },
      rivers: { type: "geojson", data: "/offline/rivers.geojson" },
      lakes: { type: "geojson", data: "/offline/lakes.geojson" },
    },
    layers: [
      {
        id: "ocean",
        type: "background",
        paint: { "background-color": "#b7d3e3" },
      },
      {
        id: "country-fill",
        type: "fill",
        source: "admin0",
        paint: { "fill-color": "#f1ecdd", "fill-opacity": 1 },
      },
      {
        id: "river-line",
        type: "line",
        source: "rivers",
        minzoom: 2,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#9dbdd4",
          "line-width": ["interpolate", ["linear"], ["get", "scalerank"], 1, 0.6, 8, 1.6],
          "line-opacity": 0.9,
        },
      },
      {
        id: "lake-fill",
        type: "fill",
        source: "lakes",
        paint: { "fill-color": "#b7d3e3" },
      },
      {
        id: "region-border",
        type: "line",
        source: "admin1",
        minzoom: 3.5,
        paint: {
          "line-color": "#d5cbb8",
          "line-width": 0.6,
          "line-dasharray": [2.5, 2.5],
        },
      },
      {
        id: "country-border",
        type: "line",
        source: "admin0",
        paint: {
          "line-color": "#9c9486",
          "line-width": 1.1,
        },
      },
      {
        id: "road-casing",
        type: "line",
        source: "roads",
        minzoom: 4,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#bdb5a4",
          "line-width": ["interpolate", ["linear"], ["get", "scalerank"], 1, 2.2, 8, 1.2],
          "line-opacity": 0.7,
        },
      },
      {
        id: "road-line",
        type: "line",
        source: "roads",
        minzoom: 4,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#ffffff",
          "line-width": ["interpolate", ["linear"], ["get", "scalerank"], 1, 1.3, 8, 0.6],
          "line-opacity": 0.92,
        },
      },
      {
        id: "place-point",
        type: "circle",
        source: "places",
        minzoom: 3,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["get", "scalerank"],
            1,
            3.2,
            3,
            2.4,
            6,
            1.8,
            10,
            1.3,
          ],
          "circle-color": "#5b554a",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 0.8,
        },
      },
      {
        id: "place-label",
        type: "symbol",
        source: "places",
        minzoom: 3.5,
        layout: {
          "text-field": nameField,
          "text-font": font,
          "text-size": [
            "interpolate",
            ["linear"],
            ["get", "scalerank"],
            1,
            13,
            3,
            11,
            6,
            9.5,
            10,
            8.5,
          ],
          "text-anchor": "top",
          "text-offset": [0, 0.4],
          "text-max-width": 9,
          "text-allow-overlap": false,
          "text-optional": true,
        },
        paint: {
          "text-color": "#3d382e",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
        },
      },
      {
        id: "country-label",
        type: "symbol",
        source: "admin0",
        minzoom: 2.6,
        layout: {
          "text-field": isArabic ? ["get", "name_ar"] : ["get", "name"],
          "text-font": font,
          "text-size": isArabic ? 10 : 9.5,
          "text-letter-spacing": 0.08,
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#6b6355",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.2,
          "text-opacity": 0.9,
        },
      },
    ],
  };
}

export function createOfflineGlLayer(locale: string) {
  return maplibreGL({
    style: buildOfflineStyle(offlineLangFromLocale(locale)),
    attributionControl: false,
    minZoom: 2,
    maxZoom: 20,
  });
}
