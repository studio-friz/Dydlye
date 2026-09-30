export type DestinationCategory =
  | "مسبح"
  | "معلم سياحي"
  | "مقهى"
  | "مطعم"
  | "حفلة"
  | "تسوق"
  | "طبيعة"
  | "ترفيه"
  | "شاطئ"
  | "رياضة"
  | "حمام تقليدي";

export type Destination = {
  id: string;
  name: string;
  description: string;
  category: DestinationCategory;
  city: string;
  location: string;
  lat: number;
  lng: number;
  images: string[];
  phone: string;
  opening_hours: string;
  rating: number;
  reviews: number;
};

// Destinations are now loaded from the Supabase `destinations` table
// (see useDestinations). Real destinations are added by the separate
// admin system and appear in the app automatically via Realtime.
export const destinations: Destination[] = [];
