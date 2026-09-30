import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/dydlye/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useSettings } from "@/i18n/useTranslation";
import { PropertyForm } from "@/features/properties/PropertyForm";
import type { PropertySubmitData, PropertyFormValues } from "@/features/properties/types";

export const Route = createFileRoute("/edit-property/$id")({
  component: EditPropertyPage,
});

interface LoadedProperty {
  initialValues: PropertyFormValues;
  images: string[];
}

function EditPropertyPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { t } = useSettings();
  const [fetching, setFetching] = useState(true);
  const [property, setProperty] = useState<LoadedProperty | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      toast.error(t("add.loginRequired"));
      navigate({ to: "/auth" });
      return;
    }

    const fetchProperty = async () => {
      try {
        const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();

        if (error || !data) {
          toast.error(t("edit.notFound"));
          navigate({ to: "/account" });
          return;
        }

        if (data.owner_id !== user.id) {
          toast.error(t("edit.unauthorized"));
          navigate({ to: "/account" });
          return;
        }

        setProperty({
          initialValues: {
            title: data.title || "",
            description: data.description || "",
            price: String(data.price || ""),
            type: (data.type || "شقة") as PropertyFormValues["type"],
            city: data.city || "",
            location: data.location || "",
            bedrooms: String(data.bedrooms || "1"),
            bathrooms: String(data.bathrooms || "1"),
            area: String(data.area || ""),
            lat: data.lat ? Number(data.lat) : null,
            lng: data.lng ? Number(data.lng) : null,
            phone: data.phone || "",
            features: data.features || [],
          },
          images: data.images || [],
        });
      } catch (err) {
        console.error("Error loading property:", err);
        toast.error(t("edit.loadError"));
        navigate({ to: "/account" });
      } finally {
        setFetching(false);
      }
    };

    fetchProperty();
  }, [id, user, authLoading, navigate, t]);

  const handleSubmit = async (data: PropertySubmitData) => {
    if (!user) return;

    const { values, images } = data;
    const price = parseFloat(values.price);

    setSaving(true);
    try {
      const { error } = await supabase
        .from("properties")
        .update({
          title: values.title,
          description: values.description,
          price,
          type: values.type,
          city: values.city,
          location: values.location,
          bedrooms: parseInt(values.bedrooms),
          bathrooms: parseInt(values.bathrooms),
          area: parseFloat(values.area),
          lat: values.lat,
          lng: values.lng,
          images,
          phone: values.phone,
          features: values.features,
        })
        .eq("id", id)
        .eq("owner_id", user.id);

      if (error) throw error;

      toast.success(t("add.updateSuccess"));
      navigate({ to: "/account" });
    } catch (err) {
      console.error("Error updating property:", err);
      toast.error(t("add.error.update"));
    } finally {
      setSaving(false);
    }
  };

  if (fetching || authLoading) {
    return (
      <AppShell>
        <div className="flex h-[60vh] w-full items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppShell>
    );
  }

  if (!property || !user) return null;

  return (
    <AppShell>
      <PropertyForm
        heading={t("edit.title")}
        userId={user.id}
        initialValues={property.initialValues}
        existingImages={property.images}
        submitLabel={t("add.save")}
        savingLabel={t("add.saving")}
        onSubmit={handleSubmit}
      />
    </AppShell>
  );
}
