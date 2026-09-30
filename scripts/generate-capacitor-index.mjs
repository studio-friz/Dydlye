/**
 * generate-capacitor-index.mjs
 *
 * بعد تشغيل vite build، يقرأ هذا السكريبت ملف index.html الناتج من Vite
 * ويحقن فيه المتغيرات البيئية والكود الخاص بتشغيل التطبيق داخل Capacitor.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, "../dist");
const indexPath = resolve(clientDir, "index.html");

// قراءة .env - نحقن فقط المتغيرات العامة (VITE_)
const envPath = resolve(__dirname, "../.env");
let envVars = {};
try {
  const envContent = readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const [key, ...value] = line.split("=");
    if (key && value && key.trim().startsWith("VITE_")) {
      envVars[key.trim()] = value
        .join("=")
        .trim()
        .replace(/^"(.*)"$/, "$1");
    }
  });
} catch {
  console.warn("⚠️ .env غير موجود أو لا يمكن قراءته");
}

// قراءة index.html المولد من Vite
let html;
try {
  html = readFileSync(indexPath, "utf-8");
} catch {
  console.error("❌ لم يتم العثور على dist/client/index.html. تأكد من تشغيل vite build أولاً.");
  process.exit(1);
}

// حقن كود Capacitor في <head>
const injectScript = `
    <script>
      window.IS_CAPACITOR = true;
      window.process = { env: ${JSON.stringify(envVars)} };
    </script>
    <link rel="manifest" href="manifest.json" />
`;

html = html.replace("</head>", `${injectScript}</head>`);

writeFileSync(indexPath, html, "utf-8");
console.log("✅ تم تحديث dist/index.html لدعم Capacitor");
