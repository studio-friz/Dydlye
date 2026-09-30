import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminProperty } from "@/lib/adminApi";
import { PROPERTY_TYPES } from "@/lib/types";
import { Button, Card, Input, Label, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { MapPicker } from "@/components/MapPicker";
import { ImageUploader } from "@/components/ImageUploader";

export function PropertyForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    type: PROPERTY_TYPES[1] as string,
    city: "",
    location: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
    phone: "",
    featuresText: "",
  });
  const [images, setImages] = useState<string[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await adminApi.properties.get(id);
        if (!data) throw new Error("missing");
        const p = data as AdminProperty;
        setForm({
          title: p.title,
          description: p.description ?? "",
          price: String(p.price),
          type: (p.type as (typeof PROPERTY_TYPES)[number]) ?? PROPERTY_TYPES[1],
          city: p.city,
          location: p.location ?? "",
          bedrooms: p.bedrooms != null ? String(p.bedrooms) : "",
          bathrooms: p.bathrooms != null ? String(p.bathrooms) : "",
          area: p.area != null ? String(p.area) : "",
          phone: p.phone ?? "",
          featuresText: (p.features ?? []).join("\n"),
        });
        setImages(p.images ?? []);
        setLat(p.lat ?? null);
        setLng(p.lng ?? null);
      } catch {
        toast.error("العقار غير موجود");
        navigate("/properties");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.city.trim() || !form.location.trim() || !form.price) {
      toast.error("العنوان والسعر والمدينة والموقع إلزامية");
      return;
    }
    if (lat == null || lng == null) {
      toast.error("حدد الموقع على الخريطة");
      return;
    }
    setSaving(true);

    const payload = {
      id: isEdit ? id : undefined,
      title: form.title.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      type: form.type,
      city: form.city.trim(),
      location: form.location.trim(),
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
      bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
      area: form.area ? Number(form.area) : null,
      phone: form.phone.trim() || null,
      images,
      features: form.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean),
      lat,
      lng,
    };

    try {
      await adminApi.properties.save(payload);
      toast.success(isEdit ? "تم تحديث العقار" : "تمت إضافة العقار — سيظهر في التطبيق فوراً");
      navigate("/properties");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={isEdit ? "تعديل العقار" : "إضافة عقار جديد"}
        subtitle="يظهر في تطبيق سكان فور الحفظ"
        action={
          <Button variant="secondary" onClick={() => navigate("/properties")}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>العنوان *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="مثال: فيلا مع مسبح قرب الشاطئ"
              />
            </div>
            <div>
              <Label>السعر (درهم) *</Label>
              <Input
                type="number"
                dir="ltr"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="1500"
              />
            </div>
            <div>
              <Label>النوع</Label>
              <Select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>المدينة *</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="مثال: مراكش"
              />
            </div>
            <div>
              <Label>العنوان التفصيلي *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="مثال: حي جيليز"
              />
            </div>
            <div>
              <Label>عدد الغرف</Label>
              <Input
                type="number"
                dir="ltr"
                value={form.bedrooms}
                onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                placeholder="2"
              />
            </div>
            <div>
              <Label>الحمامات</Label>
              <Input
                type="number"
                dir="ltr"
                value={form.bathrooms}
                onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                placeholder="1"
              />
            </div>
            <div>
              <Label>المساحة (م²)</Label>
              <Input
                type="number"
                dir="ltr"
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                placeholder="120"
              />
            </div>
            <div>
              <Label>رقم الهاتف</Label>
              <Input
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="06XXXXXXXX"
              />
            </div>
          </div>

          <div>
            <Label>الوصف</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف العقار..."
            />
          </div>

          <div>
            <Label>المميزات (كل مميزة في سطر)</Label>
            <Textarea
              rows={3}
              value={form.featuresText}
              onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
              placeholder={"مسبح\nواي فاي\nتكييف"}
            />
          </div>
        </Card>

        <Card>
          <Label>صور العقار</Label>
          <ImageUploader bucket="property-images" images={images} onChange={setImages} />
        </Card>

        <Card>
          <Label>الموقع على الخريطة (انقر لتحديد الإحداثيات) *</Label>
          <MapPicker
            lat={lat}
            lng={lng}
            onPick={(a, b) => {
              setLat(a);
              setLng(b);
            }}
          />
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/properties")}>
            إلغاء
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة العقار"}
          </Button>
        </div>
      </form>
    </div>
  );
}
