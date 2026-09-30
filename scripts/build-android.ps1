$ErrorActionPreference = "Stop"

# Auto-detect JAVA_HOME from Android Studio's bundled JBR
$studioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path "$studioJbr\bin\java.exe") {
  $env:JAVA_HOME = $studioJbr
  Write-Host "✅ JAVA_HOME = $studioJbr"
} elseif ($env:JAVA_HOME) {
  Write-Host "✅ Using existing JAVA_HOME = $env:JAVA_HOME"
} else {
  Write-Host "❌ JAVA_HOME غير محدد. الرجاء تثبيت Java JDK 17+"
  exit 1
}

# Build web app
npm run build
if (-not $?) { exit 1 }

# Generate Capacitor index
node scripts/generate-capacitor-index.mjs
if (-not $?) { exit 1 }

# Sync to Android
npx cap sync android
if (-not $?) { exit 1 }

Write-Host "✅ البناء اكتمل بنجاح!"
Write-Host "افتح Android Studio وشغّل التطبيق: npx cap open android"
