export type House = {
  id: string;
  title: string;
  location: string;
  city: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  area: number;
  type: "فيلا" | "شقة" | "رياض" | "استوديو";
  description: string;
  features: string[];
  rating: number;
  reviews: number;
  lat: number;
  lng: number;
  images: string[];
  phone: string;
};

export const houses: House[] = [];
