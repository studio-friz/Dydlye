import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type Country, type Destination } from "@/lib/adminApi";
import { DESTINATION_CATEGORIES } from "@/lib/types";
import { Button, Card, Input, Label, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { MapPicker } from "@/components/MapPicker";
import { ImageUploader } from "@/components/ImageUploader";

export function DestinationForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: "",
    description: "",
    category: DESTINATION_CATEGORIES[0] as string,
    city: "",
    location: "",
    phone: "",
    opening_hours: "",
    rating: "",
    country: searchParams.get("country") ?? "",
  });
  const [countries, setCountries] = useState<Country[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [coordsInput, setCoordsInput] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  const parseCoords = (value: string): [number, number] | null => {
    const parts = value.split(",").map((s) => s.trim());
    if (parts.length !== 2) return null;
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    if (a < -90 || a > 90 || b < -180 || b > 180) return null;
    return [a, b];
  };

  const handleCoordsInput = (value: string) => {
    setCoordsInput(value);
    const parsed = parseCoords(value);
    if (parsed) {
      setLat(parsed[0]);
      setLng(parsed[1]);
    }
  };

  const handleLatInput = (value: string) => {
    if (!value.trim()) {
      setLat(null);
      return;
    }
    const n = Number(value);
    if (!Number.isNaN(n) && n >= -90 && n <= 90) setLat(n);
  };

  const handleLngInput = (value: string) => {
    if (!value.trim()) {
      setLng(null);
      return;
    }
    const n = Number(value);
    if (!Number.isNaN(n) && n >= -180 && n <= 180) setLng(n);
  };

  useEffect(() => {
    void adminApi.destinations
      .list()
      .then(({ countries: c }) => setCountries(c))
      .catch(() => setCountries([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await adminApi.destinations.get(id);
        if (!data) throw new Error("missing");
        const d = data as Destination;
        setForm({
          name: d.name,
          description: d.description ?? "",
          category: d.category,
          city: d.city,
          location: d.location ?? "",
          phone: d.phone ?? "",
          opening_hours: d.opening_hours ?? "",
          rating: d.rating != null ? String(d.rating) : "",
          country: d.country ?? "",
        });
        setImages(d.images ?? []);
        setLat(d.lat);
        setLng(d.lng);
        setCoordsInput(
          d.lat != null && d.lng != null ? `${d.lat.toFixed(5)},${d.lng.toFixed(5)}` : "",
        );
      } catch {
        toast.error("الوجهة غير موجودة");
        navigate("/destinations");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.city.trim()) {
      toast.error("الاسم والمدينة إلزاميان");
      return;
    }
    if (lat == null || lng == null) {
      toast.error("حدد الموقع على الخريطة");
      return;
    }
    setSaving(true);

    const payload = {
      id: isEdit ? id : undefined,
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category,
      city: form.city.trim(),
      location: form.location.trim() || null,
      lat,
      lng,
      images,
      phone: form.phone.trim() || null,
      opening_hours: form.opening_hours.trim() || null,
      rating: form.rating ? Number(form.rating) : null,
      country: form.country.trim() || null,
    };

    try {
      await adminApi.destinations.save(payload);
      toast.success(isEdit ? "تم تحديث الوجهة" : "تمت إضافة الوجهة — ستظهر في التطبيق فوراً");
      navigate("/destinations");
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
        title={isEdit ? "تعديل الوجهة" : "إضافة وجهة جديدة"}
        subtitle="تظهر في تطبيق سكان فور الحفظ (Realtime)"
        action={
          <Button variant="secondary" onClick={() => navigate("/destinations")}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>اسم الوجهة *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: شاطئ أكادير"
              />
            </div>
            <div>
              <Label>التصنيف</Label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {DESTINATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>المدينة *</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="مثال: أكادير"
              />
            </div>
            <div>
              <Label>الدولة</Label>
              <Select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              >
                <option value="">بدون دولة</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                أنشئ الدول من صفحة الوجهات → إدارة الدول
              </p>
            </div>
            <div>
              <Label>العنوان / الموقع</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="مثال: الكورنيش"
              />
            </div>
          </div>

          <div>
            <Label>الوصف</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف قصير للوجهة..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>رقم الهاتف</Label>
              <Input
                dir="ltr"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="06XXXXXXXX"
              />
            </div>
            <div>
              <Label>ساعات العمل</Label>
              <Input
                value={form.opening_hours}
                onChange={(e) => setForm({ ...form, opening_hours: e.target.value })}
                placeholder="9:00 - 21:00"
              />
            </div>
            <div>
              <Label>التقييم (اختياري)</Label>
              <Input
                type="number"
                min="0"
                max="5"
                step="0.1"
                dir="ltr"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                placeholder="0 - 5"
              />
            </div>
          </div>
        </Card>

        <Card>
          <Label>صور الوجهة</Label>
          <ImageUploader bucket="destination-images" images={images} onChange={setImages} />
        </Card>

        <Card>
          <Label>الإحداثيات (يمكن الكتابة أو النقر على الخريطة) *</Label>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <Label>الإحداثيات بصيغة lat,lng</Label>
              <Input
                dir="ltr"
                placeholder="35.24264,-5.18186"
                value={coordsInput}
                onChange={(e) => handleCoordsInput(e.target.value)}
              />
            </div>
            <div>
              <Label>خط العرض</Label>
              <Input
                dir="ltr"
                type="number"
                step="any"
                placeholder="35.24264"
                value={lat ?? ""}
                onChange={(e) => handleLatInput(e.target.value)}
              />
            </div>
            <div>
              <Label>خط الطول</Label>
              <Input
                dir="ltr"
                type="number"
                step="any"
                placeholder="-5.18186"
                value={lng ?? ""}
                onChange={(e) => handleLngInput(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <Label>الموقع على الخريطة (انقر لتحديد الإحداثيات) *</Label>
            <MapPicker
              lat={lat}
              lng={lng}
              onPick={(a, b) => {
                setLat(a);
                setLng(b);
                setCoordsInput(`${a.toFixed(5)},${b.toFixed(5)}`);
              }}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/destinations")}>
            إلغاء
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الوجهة"}
          </Button>
        </div>
      </form>
    </div>
  );
}
