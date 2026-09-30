/**
 * generate-offline-map.mjs
 *
 * يولّد أصول الخريطة الأفريقية المدمجة (تعمل دون إنترنت) من بيانات
 * Natural Earth (إصدار 10m، مجال عام) ويضعها في public/offline:
 *   - admin0.geojson  : حدود الدول
 *   - admin1.geojson  : حدود الأقاليم/الولايات
 *   - places.geojson  : المدن (مع أسماء عربية/فرنسية)
 *   - roads.geojson   : الطرق الرئيسية
 *   - rivers.geojnas… : الأنهار والبحيرات
 *   - fonts/          : خطوط التسميات (لاتيني + عربي) بصيغة PBF
 *   - metadata.json   : ملخص الحجم والطبقات
 *
 * التشغيل: node scripts/generate-offline-map.mjs
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { tmpdir } from "os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/offline");
const CACHE_DIR = resolve(tmpdir(), "dydlye-ne-cache");
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(CACHE_DIR, { recursive: true });

// ====== بيانات البلدان الأفريقية (ISO A2 -> A3 كما في Natural Earth) ======
const AFRICA = {
  MA: "MAR",
  DZ: "DZA",
  TN: "TUN",
  LY: "LBY",
  EG: "EGY",
  SD: "SDN",
  SS: "SDS",
  ER: "ERI",
  ET: "ETH",
  DJ: "DJI",
  SO: "SOM",
  KE: "KEN",
  TZ: "TZA",
  UG: "UGA",
  RW: "RWA",
  BI: "BDI",
  CD: "COD",
  CG: "COG",
  GA: "GAB",
  GQ: "GNQ",
  CM: "CMR",
  CF: "CAF",
  TD: "TCD",
  NE: "NER",
  ML: "MLI",
  MR: "MRT",
  SN: "SEN",
  GM: "GMB",
  GN: "GIN",
  GW: "GNB",
  SL: "SLE",
  LR: "LBR",
  CI: "CIV",
  GH: "GHA",
  TG: "TGO",
  BJ: "BEN",
  BF: "BFA",
  NG: "NGA",
  AO: "AGO",
  ZM: "ZMB",
  ZW: "ZWE",
  MW: "MWI",
  MZ: "MOZ",
  MG: "MDG",
  BW: "BWA",
  NA: "NAM",
  ZA: "ZAF",
  SZ: "SWZ",
  LS: "LSO",
  CV: "CPV",
  ST: "STP",
  KM: "COM",
  MU: "MUS",
  SC: "SYC",
  EH: "ESH",
};

// ====== حدود أفريقيا كما يستخدمها التطبيق (تطابق maxBounds في الخريطة) ======
const AFRICA_BOX = { west: -19.0, south: -35.0, east: 52.0, north: 37.5 };

// ====== طبقات Natural Earth (الرابط الرسمي على naciscdn.org) ======
const LAYERS = {
  admin0: {
    url: "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip",
    key: "admin0",
    props: ["ADMIN", "NAME", "NAME_AR", "NAME_FR", "ISO_A2", "ADM0_A3", "POP_EST"],
  },
  admin1: {
    url: "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip",
    key: "admin1",
    props: ["name", "name_ar", "name_fr", "adm0_a3", "iso_3166_2", "scalerank"],
  },
  places: {
    url: "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_populated_places.zip",
    key: "places",
    props: ["NAME", "NAME_AR", "FEATURECLA", "ADM0NAME", "ADM0_A3", "SCALERANK", "POP_MAX"],
  },
  roads: {
    url: "https://naciscdn.org/naturalearth/10m/cultural/ne_10m_roads.zip",
    key: "roads",
    props: ["name", "featurecla", "type", "sov_a3", "continent", "scalerank", "min_zoom", "level"],
  },
  rivers: {
    url: "https://naciscdn.org/naturalearth/10m/physical/ne_10m_rivers_lake_centerlines.zip",
    key: "rivers",
    props: ["name", "name_ar", "name_fr", "featurecla", "scalerank"],
  },
  lakes: {
    url: "https://naciscdn.org/naturalearth/10m/physical/ne_10m_lakes.zip",
    key: "lakes",
    props: ["name", "name_ar", "name_fr", "featurecla", "scalerank"],
  },
};

// ====== مدن أفريقية كبرى بأسمائها العربية ======
const ARABIC_CITIES = [
  ["الدار البيضاء", 33.5731, -7.5898, "Morocco"],
  ["الرباط", 34.0209, -6.8416, "Morocco"],
  ["مراكش", 31.6295, -7.9811, "Morocco"],
  ["فاس", 34.0181, -5.0078, "Morocco"],
  ["طنجة", 35.7595, -5.834, "Morocco"],
  ["أغادير", 30.4278, -9.5981, "Morocco"],
  ["الجزائر", 36.7538, 3.0588, "Algeria"],
  ["وهران", 35.6971, -0.6308, "Algeria"],
  ["قسنطينة", 36.3669, 6.6144, "Algeria"],
  ["تونس", 36.8065, 10.1815, "Tunisia"],
  ["صفاقس", 34.741, 10.76, "Tunisia"],
  ["طرابلس", 32.8872, 13.1913, "Libya"],
  ["بنغازي", 32.1167, 20.0667, "Libya"],
  ["القاهرة", 30.0444, 31.2357, "Egypt"],
  ["الإسكندرية", 31.2001, 29.9187, "Egypt"],
  ["الخرطوم", 15.5, 32.5599, "Sudan"],
  ["أم درمان", 15.6458, 32.4833, "Sudan"],
  ["جوبا", 4.8517, 31.5825, "S. Sudan"],
  ["داكار", 14.6928, -17.4467, "Senegal"],
  ["نواكشوط", 18.0788, -15.9702, "Mauritania"],
  ["باماكو", 12.6392, -8.0029, "Mali"],
  ["واغادوغو", 12.3714, -1.5197, "Burkina Faso"],
  ["نيامي", 13.5155, 2.1281, "Niger"],
  ["نجامينا", 12.1348, 15.0557, "Chad"],
  ["أبوجا", 9.0765, 7.3986, "Nigeria"],
  ["لاغوس", 6.5244, 3.3792, "Nigeria"],
  ["كوناكري", 9.6412, -13.5784, "Guinea"],
  ["فريتاون", 8.4847, -13.2343, "Sierra Leone"],
  ["مونروفيا", 6.3008, -10.7971, "Liberia"],
  ["أبيدجان", 5.3599, -4.0083, "Ivory Coast"],
  ["أكرا", 5.6037, -0.187, "Ghana"],
  ["لوميه", 6.1256, 1.2254, "Togo"],
  ["بورتو نوفو", 6.4969, 2.6059, "Benin"],
  ["كانو", 12.0022, 8.592, "Nigeria"],
  ["كيغالي", -1.9441, 30.0619, "Rwanda"],
  ["بوجمبورا", -3.3614, 29.36, "Burundi"],
  ["كينشاسا", -4.4419, 15.2663, "Dem. Rep. Congo"],
  ["برازافيل", -4.2634, 15.2429, "Congo"],
  ["ليبرفيل", 0.4162, 9.4673, "Gabon"],
  ["لواندا", -8.839, 13.2894, "Angola"],
  ["ويندهوك", -22.5609, 17.0658, "Namibia"],
  ["غابورون", -24.6282, 25.9231, "Botswana"],
  ["بريتوريا", -25.7461, 28.1881, "South Africa"],
  ["جوهانسبرغ", -26.2041, 28.0473, "South Africa"],
  ["كيب تاون", -33.9249, 18.4241, "South Africa"],
  ["ديربان", -29.8587, 31.0218, "South Africa"],
  ["مابوتو", -25.9653, 32.5892, "Mozambique"],
  ["هراري", -17.8252, 31.0335, "Zimbabwe"],
  ["لوساكا", -15.3875, 28.3228, "Zambia"],
  ["ليلونغوي", -13.9626, 33.7741, "Malawi"],
  ["دار السلام", -6.7924, 39.2083, "Tanzania"],
  ["دودوما", -6.163, 35.7516, "Tanzania"],
  ["نيروبي", -1.2921, 36.8219, "Kenya"],
  ["كمبالا", 0.3476, 32.5825, "Uganda"],
  ["أديس أبابا", 9.032, 38.7469, "Ethiopia"],
  ["أسمرة", 15.3315, 38.9256, "Eritrea"],
  ["جيبوتي", 11.588, 43.145, "Djibouti"],
  ["مقديشو", 2.0469, 45.3182, "Somalia"],
  ["أنتاناناريفو", -18.8792, 47.5079, "Madagascar"],
  ["بورت لويس", -20.1609, 57.5012, "Mauritius"],
  ["برايا", 14.9315, -23.5125, "Cape Verde"],
  ["بنجول", 13.4549, -16.579, "Gambia"],
  ["بيساو", 11.8636, -15.5977, "Guinea-Bissau"],
  ["مالابو", 3.75, 8.7833, "Eq. Guinea"],
  ["بانغي", 4.3947, 18.5582, "Central African Rep."],
  ["سان لوي", 16.0272, -16.4896, "Senegal"],
  ["القنيطرة", 34.261, -6.5802, "Morocco"],
  ["الداخلة", 23.7154, -15.9322, "W. Sahara"],
  ["العيون", 27.1253, -13.1625, "W. Sahara"],
  ["سينسوكور", 16.0884, -9.8037, "Mauritania"],
].filter((c) => c[2] !== 0);

// ====== أدوات هندسية بسيطة ======
function pickCoords(geom, cb) {
  if (geom.type === "Point") cb(geom.coordinates);
  else if (geom.type === "MultiPoint") geom.coordinates.forEach(cb);
  else if (geom.type === "LineString") geom.coordinates.forEach(cb);
  else if (geom.type === "MultiLineString") geom.coordinates.forEach((line) => line.forEach(cb));
  else if (geom.type === "Polygon") geom.coordinates.forEach((ring) => ring.forEach(cb));
  else if (geom.type === "MultiPolygon")
    geom.coordinates.forEach((poly) => poly.forEach((ring) => ring.forEach(cb)));
}

function raycastInPoly(lon, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0],
        yi = ring[i][1],
        xj = ring[j][0],
        yj = ring[j][1];
      const intersects =
        yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi;
      if (intersects) inside = !inside;
    }
  }
  return inside;
}

function buildCountryGeomList(admin0Features) {
  const polys = [];
  for (const f of admin0Features) {
    if (!f.geometry) continue;
    if (f.geometry.type === "Polygon") polys.push(f.geometry.coordinates);
    else if (f.geometry.type === "MultiPolygon") polys.push(f.geometry.coordinates.flat());
  }
  return polys;
}

function pointInsideAfrica(lon, lat, countryPolys) {
  if (
    lon < AFRICA_BOX.west ||
    lon > AFRICA_BOX.east ||
    lat < AFRICA_BOX.south ||
    lat > AFRICA_BOX.north
  )
    return false;
  for (const rings of countryPolys) {
    if (raycastInPoly(lon, lat, rings)) return true;
  }
  return false;
}

function featureBBox(f) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  pickCoords(f.geometry, ([lon, lat]) => {
    if (lon < x0) x0 = lon;
    if (lon > x1) x1 = lon;
    if (lat < y0) y0 = lat;
    if (lat > y1) y1 = lat;
  });
  return [x0, y0, x1, y1];
}

function bboxIntersectsBox([x0, y0, x1, y1], box) {
  return x0 <= box.east && x1 >= box.west && y0 <= box.north && y1 >= box.south;
}

// ====== تحميل + فك ضغط shapefile ======
let shpParse = null;
async function parseZip(url, cacheFile) {
  const cachePath = resolve(CACHE_DIR, cacheFile);
  let buf;
  if (existsSync(cachePath)) {
    buf = readFileSync(cachePath);
    console.log(`  [cache] ${cacheFile}`);
  } else {
    console.log(`  [fetch] ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`download failed ${res.status} ${url}`);
    buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(cachePath, buf);
  }
  if (!shpParse) {
    const mod = await import("shpjs");
    shpParse = mod.default ?? (typeof mod === "function" ? mod : null);
    if (!shpParse) throw new Error("shpjs parse function not found");
  }
  const out = await shpParse.call({}, buf);
  if (!out) throw new Error(`shpjs returned nothing for ${cacheFile}`);
  if (out.type === "FeatureCollection") return out;
  // في حال أرجعت كائناً بالمفاتيح
  const fc = Object.values(out).find((v) => v && v.type === "FeatureCollection");
  if (fc) return fc;
  throw new Error(`unexpected shpjs output for ${cacheFile}`);
}

function norm(feats, mapProp) {
  return feats.map((f) => ({
    type: "Feature",
    properties: mapProp(f.properties),
    geometry: f.geometry,
  }));
}

// ====== توليد الطبقات ======
// صيغة قياسية للميزات (أسماء حقول موحدة camelCase)
const toCountry = (p) => ({
  name: p.NAME ?? p.ADMIN ?? "",
  name_ar: p.NAME_AR ? String(p.NAME_AR).split("|")[0].trim() : "",
  name_fr: p.NAME_FR ? String(p.NAME_FR).split("|")[0].trim() : "",
  iso_a2: p.ISO_A2 ?? p.ADM0_A3 ?? "",
  pop_est: p.POP_EST ?? 0,
});
const toRegion = (p) => ({
  name: p.name ?? "",
  iso_3166_2: p.iso_3166_2 ?? "",
  adm0_a3: p.adm0_a3 ?? "",
  scalerank: p.scalerank ?? 10,
});
const toPlace = (p) => {
  const ar = p.name_ar || (p.NAME_AR ? String(p.NAME_AR).split("|")[0].trim() : "");
  return {
    name: p.name || p.NAME || "",
    name_ar: ar,
    name_ascii: p.name_ascii || p.NAMEASCII || p.name || p.NAME || "",
    featurecla: p.FEATURECLA || p.featurecla || "",
    adm0: p.adm0name || p.ADM0NAME || "",
    adm0_a3: p.adm0_a3 || p.ADM0_A3 || "",
    scalerank: p.scalerank || p.SCALERANK || 8,
    pop_max: p.pop_max || p.POP_MAX || 0,
  };
};
const toRoad = (p) => ({
  name: p.name ?? "",
  featurecla: p.featurecla ?? "",
  type: p.type ?? "",
  scalerank: p.scalerank ?? 8,
  level: p.level ?? p.min_zoom ?? 8,
});
const toWater = (p) => ({
  name: p.name ?? ("name_en" in p ? p.name_en : ""),
  name_ar: p.name_ar ? String(p.name_ar).split("|")[0].trim() : "",
  name_fr: p.name_fr ? String(p.name_fr).split("|")[0].trim() : "",
  scalerank: p.scalerank ?? 8,
});

async function generate() {
  console.log("▶ مرحلة 1: تحميل الطبقات من Natural Earth");
  const raw = {};
  for (const [k, cfg] of Object.entries(LAYERS)) {
    const name = cfg.url.split("/").pop();
    raw[k] = await parseZip(cfg.url, name);
    console.log(`  ${k}: ${raw[k].features.length} عنصر`);
  }

  console.log("\n▶ مرحلة 2: الفلترة لأفريقيا");
  const a2 = new Set(Object.keys(AFRICA));
  const a3 = new Set(Object.values(AFRICA));

  // admin0: بالكود فقط
  const admin0Feats = raw.admin0.features.filter((f) => {
    const iso = f.properties?.ISO_A2;
    const a3c = f.properties?.ADM0_A3;
    return a2.has(iso) || a3.has(a3c);
  });
  console.log(`  admin0: ${admin0Feats.length} دولة`);

  // المؤامرة الداخلية للدول الأفريقية المسموحة فقط (للاختبار المكاني)
  const countryPolys = buildCountryGeomList(admin0Feats);

  // admin1: بالكود adm0_a3
  const admin1Feats = raw.admin1.features.filter((f) => a3.has(f.properties?.adm0_a3));
  console.log(`  admin1: ${admin1Feats.length} إقليم`);

  // places: بالكود (حقول الشكل مكتوبة بأحرف كبيرة) أو داخل أراضي أفريقيا
  const placesFeats = raw.places.features.filter((f) => {
    if (a3.has(f.properties?.ADM0_A3)) return true;
    const [x0, y0, x1, y1] = featureBBox(f);
    if (!bboxIntersectsBox([x0, y0, x1, y1], AFRICA_BOX)) return false;
    const lon = (x0 + x1) / 2,
      lat = (y0 + y1) / 2;
    return pointInsideAfrica(lon, lat, countryPolys);
  });
  console.log(`  places: ${placesFeats.length} بلدة`);

  // roads: continent == Africa أو نقاط عينة داخل أفريقيا
  const roadsFeats = raw.roads.features.filter((f) => {
    const cont = String(f.properties?.continent ?? "").toLowerCase();
    if (cont === "africa") return true;
    if (!bboxIntersectsBox(featureBBox(f), AFRICA_BOX)) return false;
    let hit = false;
    let i = 0;
    pickCoords(f.geometry, ([lon, lat]) => {
      if (hit) return;
      if (i++ % 8 !== 0) return;
      if (pointInsideAfrica(lon, lat, countryPolys)) hit = true;
    });
    return hit;
  });
  console.log(`  roads: ${roadsFeats.length} طريق`);

  // rivers: نقاط عينة داخل أفريقيا
  const riversFeats = raw.rivers.features.filter((f) => {
    if (!bboxIntersectsBox(featureBBox(f), AFRICA_BOX)) return false;
    let hit = false;
    let i = 0;
    pickCoords(f.geometry, ([lon, lat]) => {
      if (hit) return;
      if (i++ % 6 !== 0) return;
      if (pointInsideAfrica(lon, lat, countryPolys)) hit = true;
    });
    return hit;
  });
  console.log(`  rivers: ${riversFeats.length} نهر`);

  // lakes: أي رأس داخل أفريقيا
  const lakesFeats = raw.lakes.features.filter((f) => {
    if (!bboxIntersectsBox(featureBBox(f), AFRICA_BOX)) return false;
    let hit = false;
    pickCoords(f.geometry, ([lon, lat]) => {
      if (hit) return;
      if (pointInsideAfrica(lon, lat, countryPolys)) hit = true;
    });
    return hit;
  });
  console.log(`  lakes: ${lakesFeats.length} بحيرة`);

  // دمج المدن العربية المختارة (كمدن إضافية)
  const extraCities = ARABIC_CITIES.map(([name, lat, lng, country]) => ({
    type: "Feature",
    properties: {
      name,
      name_ar: name,
      name_ascii: name,
      featurecla: "Populated place",
      adm0: country,
      scalerank: 2,
      pop_max: 3000000,
    },
    geometry: { type: "Point", coordinates: [lng, lat] },
  }));
  const allPlaces = norm(placesFeats, toPlace).concat(extraCities);

  console.log("\n▶ مرحلة 3: الكتابة");
  const writes = {
    "admin0.geojson": norm(admin0Feats, toCountry),
    "admin1.geojson": norm(admin1Feats, toRegion),
    "places.geojson": allPlaces,
    "roads.geojson": norm(roadsFeats, toRoad),
    "rivers.geojson": norm(riversFeats, toWater),
    "lakes.geojson": norm(lakesFeats, toWater),
  };

  const meta = {};
  for (const [file, feats] of Object.entries(writes)) {
    const fc = { type: "FeatureCollection", features: feats };
    const json = JSON.stringify(fc);
    writeFileSync(resolve(OUT_DIR, file), json);
    meta[file] = { features: feats.length, bytes: json.length };
    console.log(`  ${file}: ${feats.length} عنصر، ${(json.length / 1024 / 1024).toFixed(1)}MB`);
  }

  console.log("\n▶ مرحلة 4: الخطوط (glyphs)");
  const FONT_SERVERS = {
    "Noto Sans Regular": "https://demotiles.maplibre.org/font/Noto%20Sans%20Regular/{range}.pbf",
    "Noto Sans Arabic Regular":
      "https://fonts.openmaptiles.org/Noto%20Sans%20Arabic%20Regular/{range}.pbf",
  };
  const RANGES = ["0-255", "256-511", "512-767", "768-1023", "1536-1791", "1792-2047", "4352-4607"];
  let fontBytes = 0;
  for (const [font, server] of Object.entries(FONT_SERVERS)) {
    const dir = resolve(OUT_DIR, "fonts", font);
    mkdirSync(dir, { recursive: true });
    for (const rng of RANGES) {
      const url = server.replace("{range}", rng);
      const out = resolve(dir, `${rng}.pbf`);
      if (!existsSync(out) || readFileSync(out).length < 10) {
        const res = await fetch(url);
        if (!res.ok) {
          console.log(`  [skip] ${font} ${rng} (${res.status})`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(out, buf);
        fontBytes += buf.length;
      }
    }
    console.log(`  ${font}: تم التنزيل`);
  }
  meta.fonts = { bytes: fontBytes };

  // الأسماء العربية للدول (إن وُجدت)
  const arabicNames = {};
  for (const f of raw.admin0.features) {
    if (f.properties?.NAME_AR) {
      const iso = f.properties.ISO_A2 || f.properties.ADM0_A3;
      if (iso) arabicNames[iso] = String(f.properties.NAME_AR).split("|")[0].trim();
    }
  }

  writeFileSync(
    resolve(OUT_DIR, "metadata.json"),
    JSON.stringify({ ...meta, arabicCountryNames: arabicNames }, null, 2),
  );
  const totalMB =
    Object.values(writes).reduce((s, arr) => s + JSON.stringify(arr).length, 0) / 1024 / 1024;
  console.log(`\n✅ تم التوليد. الحجم الإجمالي للبيانات: ${totalMB.toFixed(1)}MB`);
}

generate().catch((e) => {
  console.error(e);
  process.exit(1);
});
