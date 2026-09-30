export const propertyTypes = ["شقة", "فيلا", "رياض", "استوديو"] as const;
export type PropertyType = (typeof propertyTypes)[number];

export const commonFeatures = [
  "مسبح",
  "حديقة",
  "موقف سيارات",
  "أمن 24/7",
  "تكييف",
  "مصعد",
  "إطلالة بحر",
  "مؤثث",
  "واي فاي",
  "شرفة",
] as const;

export interface PropertyFormValues {
  title: string;
  description: string;
  price: string;
  type: PropertyType;
  city: string;
  location: string;
  bedrooms: string;
  bathrooms: string;
  area: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  features: string[];
}

export const defaultPropertyValues: PropertyFormValues = {
  title: "",
  description: "",
  price: "",
  type: "شقة",
  city: "",
  location: "",
  bedrooms: "1",
  bathrooms: "1",
  area: "",
  lat: null,
  lng: null,
  phone: "",
  features: [],
};

export interface PropertySubmitData {
  values: PropertyFormValues;
  images: string[];
}
