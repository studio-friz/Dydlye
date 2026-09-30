import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/dydlye/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { useSettings } from "@/i18n/useTranslation";
import { setMode } from "@/lib/destinationMode";
import { PropertyForm } from "@/features/properties/PropertyForm";
import type { PropertySubmitData } from "@/features/properties/types";

export const Route = createFileRoute("/add-property")({
  component: AddPropertyPage,
});

function AddPropertyPage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useProfile(user?.id);
  const navigate = useNavigate();
  const { t } = useSettings();

  const isNonHost = !profileLoading && !!user && !!profile && !profile.is_host;

  useEffect(() => {
    if (isNonHost) {
      navigate({ to: "/become-host" });
    }
  }, [isNonHost, navigate]);

  if (!user || isNonHost) return null;

  const handleSubmit = async (data: PropertySubmitData) => {
    const { values, images } = data;
    const price = parseFloat(values.price);
    const area = values.area ? parseFloat(values.area) : 0;
    const bedrooms = parseInt(values.bedrooms) || 1;
    const bathrooms = parseInt(values.bathrooms) || 1;

    const { error } = await supabase.from("properties").insert({
      title: values.title,
      description: values.description,
      price,
      type: values.type,
      city: values.city,
      location: values.location,
      bedrooms,
      bathrooms,
      area,
      lat: values.lat,
      lng: values.lng,
      owner_id: user.id,
      images,
      phone: values.phone || null,
      features: values.features,
    });

    if (error) {
      const msg = error.message?.includes("foreign key")
        ? t("add.error.user")
        : error.message?.includes("violates row-level security")
          ? t("add.error.permission")
          : error.message || t("add.error.generic");
      toast.error(msg);
      return;
    }

    toast.success(t("add.success"));
    setMode("houses");
    navigate({ to: "/" });
  };

  return (
    <AppShell>
      <PropertyForm
        heading={t("add.title")}
        userId={user.id}
        submitLabel={t("add.publish")}
        savingLabel={t("add.saving")}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
