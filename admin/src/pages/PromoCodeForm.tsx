import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Save } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type PromoCode } from "@/lib/adminApi";
import { Button, Card, Input, Label, PageHeader, Spinner, Textarea } from "@/components/ui";

export function PromoCodeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    code: "",
    discount_percent: "",
    description: "",
    max_uses: "",
    expires_at: "",
    is_active: true,
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await adminApi.promo.get(id);
        const c = data as PromoCode;
        setForm({
          code: c.code,
          discount_percent: String(c.discount_percent),
          description: c.description ?? "",
          max_uses: c.max_uses != null ? String(c.max_uses) : "",
          expires_at: c.expires_at ? new Date(c.expires_at).toISOString().slice(0, 16) : "",
          is_active: c.is_active,
        });
      } catch {
        toast.error("الكود غير موجود");
        navigate("/promo-codes");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const discount = Number(form.discount_percent);
    if (!form.code.trim()) {
      toast.error("الكود إلزامي");
      return;
    }
    if (!form.discount_percent || discount < 0 || discount > 100) {
      toast.error("نسبة الخصم يجب أن تكون بين 0 و 100");
      return;
    }
    if (form.max_uses && Number(form.max_uses) < 0) {
      toast.error("أقصى عدد استخدامات غير صالح");
      return;
    }
    setSaving(true);

    const payload = {
      id: isEdit ? id : undefined,
      code: form.code.trim().toUpperCase(),
      discount_percent: discount,
      description: form.description.trim() || null,
      max_uses: form.max_uses ? Number(form.max_uses) : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      is_active: form.is_active,
    };

    try {
      await adminApi.promo.save(payload);
      toast.success(isEdit ? "تم تحديث كود الخصم" : "تمت إضافة كود الخصم بنجاح");
      navigate("/promo-codes");
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
        title={isEdit ? "تعديل كود الخصم" : "إضافة كود خصم جديد"}
        action={
          <Button variant="secondary" onClick={() => navigate("/promo-codes")}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>الكود *</Label>
              <Input
                dir="ltr"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="مثال: DYD50"
              />
            </div>
            <div>
              <Label>نسبة الخصم (%) *</Label>
              <Input
                type="number"
                min="0"
                max="100"
                dir="ltr"
                value={form.discount_percent}
                onChange={(e) => setForm({ ...form, discount_percent: e.target.value })}
                placeholder="50"
              />
            </div>
            <div>
              <Label>أقصى عدد استخدامات (اختياري)</Label>
              <Input
                type="number"
                min="0"
                dir="ltr"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                placeholder="اتركه فارغاً لغير المحدود"
              />
            </div>
            <div>
              <Label>تاريخ الانتهاء (اختياري)</Label>
              <Input
                type="datetime-local"
                dir="ltr"
                value={form.expires_at}
                onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>الوصف</Label>
            <Textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="وصف الكود (يظهر للمستخدمين)..."
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
            <span className="text-sm font-bold text-foreground">
              الكود نشط ويمكن للمستخدمين استخدامه
            </span>
          </label>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate("/promo-codes")}>
            إلغاء
          </Button>
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "إضافة الكود"}
          </Button>
        </div>
      </form>
    </div>
  );
}
