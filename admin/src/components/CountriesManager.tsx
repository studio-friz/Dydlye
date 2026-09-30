import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type Country } from "@/lib/adminApi";
import { deleteCountry } from "@/lib/admin-actions";
import { Button, Card, ConfirmDialog, EmptyState, Input, Label, Spinner } from "@/components/ui";
import { ImageUploader } from "@/components/ImageUploader";

interface CountriesManagerProps {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function CountriesManager({ open, onClose, onChanged }: CountriesManagerProps) {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [image, setImage] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Country | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { countries: c } = await adminApi.destinations.list();
      setCountries(c);
    } catch {
      setCountries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setName("");
      setImage([]);
      void load();
    }
  }, [open, load]);

  if (!open) return null;

  const handleAdd = async () => {
    if (!name.trim()) {
      toast.error("اكتب اسم الدولة");
      return;
    }
    setSaving(true);
    try {
      await adminApi.destinations.saveCountry(name.trim(), image[0] ?? null);
      toast.success("تمت إضافة الدولة");
      onChanged();
      void load();
      setName("");
      setImage([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الإضافة");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const res = await deleteCountry(toDelete.name);
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("تم حذف الدولة والوجهات أصبحت غير مصنفة");
    setToDelete(null);
    onChanged();
    void load();
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold text-foreground">إدارة الدول</h3>
          <Button variant="ghost" className="h-8 px-3" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        <div className="mb-4 rounded-2xl border border-border bg-secondary/50 p-4">
          <Label>اسم الدولة</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="مثال: المغرب"
          />
          <div className="mt-3">
            <Label>صورة الدولة</Label>
            <ImageUploader bucket="country-images" images={image} onChange={setImage} />
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? "جاري الإضافة..." : "إضافة الدولة"}
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : countries.length === 0 ? (
            <Card className="border-0">
              <EmptyState
                icon="🌍"
                title="لا توجد دول بعد"
                hint="أضف أول دولة مع صورة لتظهر للزوار"
              />
            </Card>
          ) : (
            countries.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {c.image ? (
                    <img
                      src={c.image}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      width={640}
                      height={640}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl">🌍</div>
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                  {c.name}
                </span>
                <Button
                  variant="destructive"
                  className="h-8 px-3 text-xs"
                  onClick={() => setToDelete(c)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  حذف
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={toDelete != null}
        title="حذف الدولة"
        message={`هل أنت متأكد من حذف "${toDelete?.name}"؟ ستصبح وجهاتها غير مصنفة.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
