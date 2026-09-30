export const DESTINATION_CATEGORIES = [
  "مسبح",
  "معلم سياحي",
  "مقهى",
  "مطعم",
  "حفلة",
  "تسوق",
  "طبيعة",
  "ترفيه",
  "شاطئ",
  "رياضة",
  "حمام تقليدي",
  "شلالات",
] as const;

export type DestinationCategory = (typeof DESTINATION_CATEGORIES)[number];

export interface Destination {
  id: string;
  name: string;
  description: string | null;
  category: string;
  city: string;
  location: string | null;
  lat: number;
  lng: number;
  images: string[] | null;
  phone: string | null;
  opening_hours: string | null;
  rating: number | null;
  reviews: number | null;
  country: string | null;
  sort_order: number;
  created_at: string;
}

export interface Country {
  id: string;
  name: string;
  image: string | null;
  created_at: string;
}

export const UNASSIGNED_COUNTRY = "غير مصنفة";

export const PROPERTY_TYPES = ["فيلا", "شقة", "رياض", "استوديو"] as const;

export interface Property {
  id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  price: number;
  type: string | null;
  city: string;
  location: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number | null;
  images: string[] | null;
  features: string[] | null;
  rating: number | null;
  reviews: number | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  description: string | null;
  max_uses: number | null;
  uses_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}
