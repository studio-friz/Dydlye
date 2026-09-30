import type { DestinationCategory } from "@/data/destinations";

export const destIcons: Record<DestinationCategory, string> = {
  شاطئ: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M8 6h8M6 10h12M5 14h14M4 18h16M6 22l1-2 1 2 1-2 1 2 1-2 1 2 1-2 1 2 1-2 1 2"/></svg>',
  "معلم سياحي":
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>',
  طبيعة:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c-4 0-8-3.5-8-9 0-5 4-9 8-11 4 2 8 6 8 11 0 5.5-4 9-8 9zM12 13a3 3 0 100-6 3 3 0 000 6z"/></svg>',
  مسبح: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10h20v10a2 2 0 01-2 2H4a2 2 0 01-2-2V10zM6 10V6a3 3 0 016 0v4M18 10V6a3 3 0 00-6 0v4M2 16h20"/></svg>',
  رياضة:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zM12 2a15 15 0 010 20 15 15 0 010-20zM2 12h20"/></svg>',
  "حمام تقليدي":
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16M6 8v8a2 2 0 002 2h8a2 2 0 002-2V8M8 4v2M16 4v2M12 4v2M10 14h4M12 12v4"/></svg>',
  ترفيه:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h20v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM12 18v-6M8 12h8M12 10a1 1 0 100-2 1 1 0 000 2z"/></svg>',
  مطعم: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>',
  مقهى: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>',
  تسوق: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/></svg>',
  حفلة: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L15 9 22 9 16.5 13.5 19 21 12 16 5 21 7.5 13.5 2 9 9 9 11 2"/></svg>',
};

export const destCatGradients: Record<DestinationCategory, string> = {
  شاطئ: "from-yellow-400 to-amber-300",
  "معلم سياحي": "from-amber-500 to-orange-400",
  طبيعة: "from-emerald-500 to-green-400",
  مسبح: "from-sky-500 to-cyan-400",
  رياضة: "from-lime-500 to-green-400",
  "حمام تقليدي": "from-stone-500 to-neutral-400",
  ترفيه: "from-blue-500 to-indigo-400",
  مطعم: "from-red-500 to-rose-400",
  مقهى: "from-amber-800 to-amber-600",
  تسوق: "from-violet-500 to-purple-400",
  حفلة: "from-fuchsia-500 to-pink-400",
};

export const destCatColors: Record<DestinationCategory, string> = {
  شاطئ: "#eab308",
  "معلم سياحي": "#f59e0b",
  طبيعة: "#10b981",
  مسبح: "#0ea5e9",
  رياضة: "#84cc16",
  "حمام تقليدي": "#a8a29e",
  ترفيه: "#3b82f6",
  مطعم: "#e11d48",
  مقهى: "#92400e",
  تسوق: "#8b5cf6",
  حفلة: "#d946ef",
};
