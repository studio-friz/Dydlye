import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  BedDouble,
  Building2,
  Crown,
  Heart,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Users,
} from "lucide-react";
import { adminApi, type Stats } from "@/lib/adminApi";
import { Card, Spinner } from "@/components/ui";

const PIE_COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#f59e0b",
  "#e11d48",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#84cc16",
  "#a8a29e",
  "#3b82f6",
  "#f97316",
];

export function Dashboard() {
  const [counts, setCounts] = useState<Stats["counts"] | null>(null);
  const [propertiesByCity, setPropertiesByCity] = useState<{ name: string; count: number }[]>([]);
  const [destByCategory, setDestByCategory] = useState<{ name: string; count: number }[]>([]);
  const [cityStats, setCityStats] = useState<
    { name: string; properties: number; destinations: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const {
          counts: c,
          propertiesByCity: pCity,
          destinationsByCity: dCity,
          destinationsByCategory: dCat,
        } = await adminApi.stats();

        const cities = new Map<
          string,
          { name: string; properties: number; destinations: number }
        >();
        for (const [name, count] of Object.entries(pCity)) {
          cities.set(name, { name, properties: count, destinations: 0 });
        }
        for (const [name, count] of Object.entries(dCity)) {
          const entry = cities.get(name) ?? {
            name,
            properties: 0,
            destinations: 0,
          };
          entry.destinations += count;
          cities.set(name, entry);
        }
        const list = [...cities.values()].sort(
          (a, b) => b.properties + b.destinations - (a.properties + a.destinations),
        );

        setCityStats(list);
        setPropertiesByCity(
          list
            .map((x) => ({ name: x.name, count: x.properties }))
            .filter((x) => x.count > 0)
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
        );
        setDestByCategory(Object.entries(dCat).map(([name, count]) => ({ name, count })));
        setCounts(c);
      } catch (err) {
        setError(err instanceof Error ? err.message : "تعذّر تحميل الإحصائيات");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error || !counts) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-destructive">
        {error ?? "تعذّر تحميل الإحصائيات"}
      </div>
    );
  }

  const cards = [
    {
      label: "العقارات",
      value: counts.properties,
      icon: Building2,
      color: "text-primary",
    },
    {
      label: "الوجهات",
      value: counts.destinations,
      icon: MapPin,
      color: "text-sky-500",
    },
    {
      label: "المدن",
      value: counts.cities,
      icon: MapIcon,
      color: "text-teal-500",
    },
    {
      label: "المستخدمون",
      value: counts.profiles,
      icon: Users,
      color: "text-emerald-500",
    },
    {
      label: "المضيفون",
      value: counts.hosts,
      icon: Crown,
      color: "text-orange-500",
    },
    {
      label: "المستخدمون النشطون",
      value: counts.activeUsers,
      icon: Activity,
      color: "text-violet-500",
    },
    {
      label: "التعليقات",
      value: counts.comments,
      icon: MessageSquare,
      color: "text-amber-500",
    },
    {
      label: "الحجوزات",
      value: counts.bookings,
      icon: BedDouble,
      color: "text-rose-500",
    },
    {
      label: "المفضلة",
      value: counts.favorites,
      icon: Heart,
      color: "text-fuchsia-500",
    },
  ];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold text-foreground">لوحة الإحصائيات</h1>
      <p className="mb-6 text-sm text-muted-foreground">نظرة عامة على بيانات التطبيق</p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="flex items-center gap-4">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary ${c.color}`}
            >
              <c.icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-foreground">{c.value}</div>
              <div className="text-xs font-semibold text-muted-foreground">{c.label}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-extrabold text-foreground">العقارات حسب المدينة</h2>
          {propertiesByCity.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={propertiesByCity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="عدد" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-extrabold text-foreground">الوجهات حسب التصنيف</h2>
          {destByCategory.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={destByCategory}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(e) => (e as { name: string }).name}
                  fontSize={10}
                >
                  {destByCategory.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="md:col-span-2">
          <h2 className="mb-4 text-sm font-extrabold text-foreground">إحصائيات المدن</h2>
          {cityStats.length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">لا توجد بيانات</p>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-right text-xs text-muted-foreground">
                    <th className="pb-2 font-bold">المدينة</th>
                    <th className="pb-2 font-bold">العقارات</th>
                    <th className="pb-2 font-bold">الوجهات</th>
                    <th className="pb-2 font-bold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {cityStats.map((c) => (
                    <tr key={c.name} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 font-bold text-foreground">{c.name}</td>
                      <td className="py-2.5 text-muted-foreground">{c.properties}</td>
                      <td className="py-2.5 text-muted-foreground">{c.destinations}</td>
                      <td className="py-2.5 font-extrabold text-foreground">
                        {c.properties + c.destinations}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
