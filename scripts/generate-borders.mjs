/**
 * generate-borders.mjs
 *
 * يولّد ملف GeoJSON بحدود الدول الأفريقية من بيانات world-atlas (Natural Earth)
 * ويكتبه إلى public/borders/africanCountries.geojson ليُعرض كطبقة فوق الخريطة.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { feature } from "topojson-client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const atlasPath = resolve(__dirname, "../node_modules/world-atlas/countries-50m.json");
const outPath = resolve(__dirname, "../public/borders/africanCountries.geojson");

// أسماء الدول الأفريقية كما تظهر في بيانات world-atlas
// (تشمل الصحراء الغربية وصوماليلاند لإكمال الحدود داخل إفريقيا)
const AFRICAN_NAMES = new Set([
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cameroon",
  "Central African Rep.",
  "Chad",
  "Comoros",
  "Dem. Rep. Congo",
  "Congo",
  "Côte d'Ivoire",
  "Djibouti",
  "Egypt",
  "Eq. Guinea",
  "Eritrea",
  "eSwatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "São Tomé and Principe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "Somaliland",
  "South Africa",
  "S. Sudan",
  "Sudan",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "W. Sahara",
  "Zambia",
  "Zimbabwe",
]);

const topology = JSON.parse(readFileSync(atlasPath, "utf-8"));
const collection = feature(topology, topology.objects.countries);

const filtered = {
  type: "FeatureCollection",
  features: collection.features.filter((f) => f.properties && AFRICAN_NAMES.has(f.properties.name)),
};

if (filtered.features.length === 0) {
  console.error("❌ لم يتم العثور على أي دولة أفريقية في بيانات world-atlas");
  process.exit(1);
}

mkdirSync(resolve(__dirname, "../public/borders"), { recursive: true });
writeFileSync(outPath, JSON.stringify(filtered), "utf-8");
console.log(
  `✅ تم توليد ${outPath} (${filtered.features.length} دولة، ${(filtered.features.length && JSON.stringify(filtered).length / 1024).toFixed(0)}KB)`,
);
