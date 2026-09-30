import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutGrid, List, Pencil, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type Country, type Destination } from "@/lib/adminApi";
import { UNASSIGNED_COUNTRY } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { CountriesManager } from "@/components/CountriesManager";

type View = "countries" | "all";

export function Destinations() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [view, setView] = useState<View>("countries");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Destination | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { destinations: dest, countries: c } = await adminApi.destinations.list();
      setCountries(c);
      setDestinations(dest);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحميل الوجهات");
      setCountries([]);
      setDestinations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts: Record<string, number> = {};
  let unassigned = 0;
  destinations.forEach((d) => {
    if (d.country) counts[d.country] = (counts[d.country] ?? 0) + 1;
    else unassigned += 1;
  });

  const needle = query.trim().toLowerCase();

  const filteredCountries = countries.filter(
    (c) => !needle || c.name.toLowerCase().includes(needle),
  );

  const filteredDestinations = destinations.filter(
    (d) =>
      !needle || d.name.toLowerCase().includes(needle) || d.city.toLowerCase().includes(needle),
  );

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminApi.destinations.remove(toDelete.id);
      toast.success("تم حذف الوجهة");
      setToDelete(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل الحذف");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="الوجهات"
        subtitle={`${countries.length} دولة • ${destinations.length} وجهة`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setManagerOpen(true)}>
              <Settings2 className="h-4 w-4" />
              إدارة الدول
            </Button>
            <Link to="/destinations/new">
              <Button>
                <Plus className="h-4 w-4" />
                إضافة وجهة
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="inline-flex rounded-2xl bg-secondary p-1">
          <button
            onClick={() => setView("countries")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              view === "countries" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            الدول
          </button>
          <button
            onClick={() => setView("all")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
              view === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            كل الوجهات
          </button>
        </div>
        <Input
          placeholder={view === "countries" ? "ابحث عن دولة..." : "ابحث بالاسم أو المدينة..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1"
        />
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : view === "all" ? (
        filteredDestinations.length === 0 ? (
          <Card>
            <EmptyState
              icon="🗺️"
              title="لا توجد وجهات"
              hint="أضف وجهة جديدة لتظهر في التطبيق فوراً"
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredDestinations.map((d) => (
              <Card key={d.id} className="flex gap-4">
                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                  {d.images?.[0] ? (
                    <img src={d.images[0]} alt={d.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl">
                      🏝️
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-sm font-extrabold text-foreground">{d.name}</h3>
                    <Badge>{d.category}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {d.city} — {d.location ?? "بدون موقع"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {d.images?.length ?? 0} صورة • ⭐ {d.rating ?? 0}
                    {d.country ? ` • ${d.country}` : " • غير مصنفة"}
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <Link to={`/destinations/${d.id}`}>
                      <Button variant="secondary" className="h-8 px-3 text-xs">
                        <Pencil className="h-3.5 w-3.5" />
                        تعديل
                      </Button>
                    </Link>
                    <Button
                      variant="destructive"
                      className="h-8 px-3 text-xs"
                      onClick={() => setToDelete(d)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      حذف
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : filteredCountries.length === 0 && unassigned === 0 ? (
        <Card>
          <EmptyState
            icon="🌍"
            title="لا توجد دول"
            hint="اضغط على «إدارة الدول» لإضافة دول مع صور، أو راجع «كل الوجهات» للوجهات الموجودة"
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCountries.map((c) => (
            <Link
              key={c.id}
              to={`/destinations/order/${encodeURIComponent(c.name)}`}
              className="group relative overflow-hidden rounded-3xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-36 w-full bg-secondary">
                {c.image ? (
                  <img
                    src={c.image}
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    width={640}
                    height={360}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-5xl">🌍</div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <h3 className="truncate text-base font-extrabold drop-shadow">{c.name}</h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-bold opacity-90">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {counts[c.name] ?? 0} وجهة
                  </div>
                </div>
              </div>
            </Link>
          ))}

          <Link
            to={`/destinations/order/${encodeURIComponent(UNASSIGNED_COUNTRY)}`}
            className="relative overflow-hidden rounded-3xl border border-dashed border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-36 w-full flex-col items-center justify-center gap-1.5 bg-secondary/60 text-center">
              <span className="text-4xl">🗂️</span>
              <div className="text-sm font-extrabold text-foreground">غير مصنفة</div>
              <Badge>{unassigned} وجهة</Badge>
            </div>
          </Link>
        </div>
      )}

      <CountriesManager
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        onChanged={() => void load()}
      />

      <ConfirmDialog
        open={toDelete != null}
        title="حذف الوجهة"
        message={`هل أنت متأكد من حذف "${toDelete?.name}"؟ سيختفي من التطبيق فوراً.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
