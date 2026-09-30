import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, GripVertical, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type Country, type Destination } from "@/lib/adminApi";
import { UNASSIGNED_COUNTRY } from "@/lib/types";
import {
  assignDestinationToCountry,
  removeDestinationFromCountry,
  reorderDestinations,
} from "@/lib/admin-actions";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "@/components/ui";

export function DestinationOrder() {
  const { countryName } = useParams();
  const navigate = useNavigate();
  const decoded = decodeURIComponent(countryName ?? "");
  const isUnassigned = decoded === UNASSIGNED_COUNTRY;

  const [country, setCountry] = useState<Country | null>(null);
  const [items, setItems] = useState<Destination[]>([]);
  const [others, setOthers] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [addId, setAddId] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { destinations, countries } = await adminApi.destinations.list();

      if (!isUnassigned) {
        setCountry(countries.find((c) => c.name === decoded) ?? null);
      } else {
        setCountry(null);
      }

      const inList = destinations
        .filter((d) => (isUnassigned ? !d.country : d.country === decoded))
        .sort((a, b) => a.sort_order - b.sort_order);

      setItems(inList);
      setOthers(destinations.filter((d) => !inList.some((x) => x.id === d.id)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تحميل الوجهات");
    } finally {
      setLoading(false);
    }
  }, [decoded, isUnassigned]);

  useEffect(() => {
    void load();
  }, [load]);

  const addOptions = useMemo(() => {
    const needle = addQuery.trim().toLowerCase();
    return others
      .filter(
        (d) =>
          !needle || d.name.toLowerCase().includes(needle) || d.city.toLowerCase().includes(needle),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [others, addQuery]);

  const persistOrder = async (list: Destination[]) => {
    const res = await reorderDestinations(list.map((d) => ({ id: d.id })));
    if (res.ok) toast.success("تم حفظ الترتيب");
    else toast.error(res.error);
  };

  const handleDrop = (targetIndex: number) => {
    if (dragIndex == null || dragIndex === targetIndex) return;
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    const withOrder = next.map((d, i) => ({ ...d, sort_order: i + 1 }));
    setItems(withOrder);
    setDragIndex(null);
    setOverIndex(null);
    void persistOrder(withOrder);
  };

  const handleAddToOrder = async (id: string) => {
    const target = others.find((d) => d.id === id);
    if (!target) return;
    setBusy(true);
    const res = await assignDestinationToCountry(
      id,
      isUnassigned ? null : decoded,
      items.length + 1,
    );
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems([
      ...items,
      {
        ...target,
        country: isUnassigned ? null : decoded,
        sort_order: items.length + 1,
      },
    ]);
    setOthers(others.filter((d) => d.id !== id));
    setAddId("");
    setAddQuery("");
    toast.success("تمت إضافة الوجهة للترتيب");
  };

  const handleRemoveFromOrder = async (d: Destination) => {
    setBusy(true);
    const res = await removeDestinationFromCountry(d.id);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setItems(items.filter((x) => x.id !== d.id));
    setOthers([...others, { ...d, country: null, sort_order: 0 }]);
    toast.success("أصبحت الوجهة غير مصنفة");
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
        title={isUnassigned ? UNASSIGNED_COUNTRY : (country?.name ?? decoded)}
        subtitle={`${items.length} وجهة`}
        action={
          <Button variant="secondary" onClick={() => navigate("/destinations")}>
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        }
      />

      {!isUnassigned && country?.image && (
        <div className="mb-4 h-40 w-full overflow-hidden rounded-3xl border border-border">
          <img src={country.image} alt={country.name} className="h-full w-full object-cover" />
        </div>
      )}

      <Card className="mb-4">
        <div className="mb-2 text-sm font-extrabold text-foreground">إضافة وجهة لهذا الترتيب</div>
        <Input
          placeholder="ابحث عن وجهة لإضافتها..."
          value={addQuery}
          onChange={(e) => setAddQuery(e.target.value)}
          className="mb-2"
        />
        <div className="flex gap-2">
          <Select value={addId} onChange={(e) => setAddId(e.target.value)} className="flex-1">
            <option value="">اختر وجهة...</option>
            {addOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} — {d.city}
              </option>
            ))}
          </Select>
          <Button onClick={() => handleAddToOrder(addId)} disabled={!addId || busy}>
            <Plus className="h-4 w-4" />
            إضافة
          </Button>
        </div>
        <Link
          to={`/destinations/new?country=${encodeURIComponent(decoded)}`}
          className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
        >
          + أو أنشئ وجهة جديدة لهذه الدولة
        </Link>
      </Card>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon="📌"
            title="لا توجد وجهات مرتبة"
            hint="أضف وجهات من القائمة أعلاه ثم رتّبها بالسحب والإفلات"
          />
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((d, i) => (
            <div
              key={d.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setOverIndex(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(i);
              }}
              className={`flex items-center gap-3 rounded-2xl border bg-card p-3 transition ${
                dragIndex === i
                  ? "border-primary opacity-50"
                  : overIndex === i && dragIndex != null
                    ? "border-primary border-2"
                    : "border-border"
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg bg-secondary text-muted-foreground active:cursor-grabbing">
                <GripVertical className="h-4 w-4" />
              </div>
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-secondary">
                {d.images?.[0] ? (
                  <img src={d.images[0]} alt={d.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl">🏝️</div>
                )}
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] font-extrabold text-white">
                  {i + 1}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-extrabold text-foreground">{d.name}</h3>
                  <Badge>{d.category}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {d.city} — {d.location ?? "بدون موقع"}
                </p>
              </div>
              <Link to={`/destinations/${d.id}`}>
                <Button variant="secondary" className="h-8 px-3 text-xs">
                  <Pencil className="h-3.5 w-3.5" />
                  تعديل
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="h-8 px-2 text-xs text-muted-foreground"
                title="إزالة من هذا الترتيب"
                onClick={() => void handleRemoveFromOrder(d)}
                disabled={busy}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
