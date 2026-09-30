import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Spinner } from "@/components/ui";
import { Login } from "@/pages/Login";
import { adminApi } from "@/lib/adminApi";
import { configError, supabase } from "@/lib/supabase";

type AuthState = "checking" | "signed-out" | "signed-in";

const Dashboard = lazy(() => import("@/pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Destinations = lazy(() =>
  import("@/pages/Destinations").then((m) => ({ default: m.Destinations })),
);
const DestinationForm = lazy(() =>
  import("@/pages/DestinationForm").then((m) => ({
    default: m.DestinationForm,
  })),
);
const DestinationOrder = lazy(() =>
  import("@/pages/DestinationOrder").then((m) => ({
    default: m.DestinationOrder,
  })),
);
const Properties = lazy(() =>
  import("@/pages/Properties").then((m) => ({ default: m.Properties })),
);
const PropertyForm = lazy(() =>
  import("@/pages/PropertyForm").then((m) => ({
    default: m.PropertyForm,
  })),
);
const Users = lazy(() => import("@/pages/Users").then((m) => ({ default: m.Users })));
const Reports = lazy(() => import("@/pages/Reports").then((m) => ({ default: m.Reports })));
const PromoCodes = lazy(() =>
  import("@/pages/PromoCodes").then((m) => ({ default: m.PromoCodes })),
);
const PromoCodeForm = lazy(() =>
  import("@/pages/PromoCodeForm").then((m) => ({
    default: m.PromoCodeForm,
  })),
);

export default function App() {
  const [auth, setAuth] = useState<AuthState>("checking");

  const markSignedIn = useCallback(() => setAuth("signed-in"), []);

  // A session alone is not enough: admin-api must confirm the user is listed in
  // public.admins, otherwise the panel would render with no working API.
  useEffect(() => {
    if (configError) return;
    let active = true;

    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      if (!data.session) {
        setAuth("signed-out");
        return;
      }
      try {
        await adminApi.whoami();
        if (active) setAuth("signed-in");
      } catch {
        if (active) setAuth("signed-out");
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuth(session ? "checking" : "signed-out");
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (configError) {
    return (
      <div
        dir="rtl"
        className="flex min-h-dvh w-full items-center justify-center bg-background p-6"
      >
        <div className="w-full max-w-xl rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-4 flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <h1 className="text-base font-extrabold">اللوحة غير مهيأة</h1>
          </div>
          <pre className="whitespace-pre-wrap text-right font-sans text-xs leading-relaxed text-muted-foreground">
            {configError}
          </pre>
        </div>
      </div>
    );
  }

  if (auth === "checking") {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (auth === "signed-out") {
    return <Login onSignedIn={markSignedIn} />;
  }

  return (
    <Layout>
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] w-full items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/destinations/order/:countryName" element={<DestinationOrder />} />
          <Route path="/destinations/new" element={<DestinationForm />} />
          <Route path="/destinations/:id" element={<DestinationForm />} />
          <Route path="/properties" element={<Properties />} />
          <Route path="/properties/new" element={<PropertyForm />} />
          <Route path="/properties/:id" element={<PropertyForm />} />
          <Route path="/users" element={<Users />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/promo-codes" element={<PromoCodes />} />
          <Route path="/promo-codes/new" element={<PromoCodeForm />} />
          <Route path="/promo-codes/:id" element={<PromoCodeForm />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}
