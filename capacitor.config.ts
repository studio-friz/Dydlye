import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dydlye.app",
  appName: "Dydlye",
  webDir: "dist",
  server: {
    androidScheme: "https",
    // L-04: cleartext HTTP is disabled. All traffic (app assets, Supabase REST,
    // Edge Functions and Google Play Billing checks) must be HTTPS.
    cleartext: false,
  },
  plugins: {
    GoogleAuth: {
      androidClientId: "1085297218555-f2tuds0e0spt8pkgqd7ldefamce993i1.apps.googleusercontent.com",
      scopes: ["email", "profile"],
    },
  },
};

export default config;
