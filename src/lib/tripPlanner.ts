export type TripItem = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  order: number;
  completed: boolean;
};

const TRIP_KEY = "dydlye-trip";
const TRIP_EVENT = "dydlye-trip-change";

function readTrip(): TripItem[] {
  try {
    const raw = window.localStorage.getItem(TRIP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeTrip(trip: TripItem[]) {
  window.localStorage.setItem(TRIP_KEY, JSON.stringify(trip));
  window.dispatchEvent(new CustomEvent(TRIP_EVENT, { detail: trip }));
}

export function getTrip(): TripItem[] {
  return readTrip();
}

export function addToTrip(id: string, name: string, category: string, lat: number, lng: number) {
  const trip = readTrip();
  if (trip.some((t) => t.id === id)) return;
  trip.push({ id, name, category, lat, lng, order: trip.length + 1, completed: false });
  writeTrip(trip);
}

export function removeFromTrip(id: string) {
  let trip = readTrip().filter((t) => t.id !== id);
  trip = trip.map((t, i) => ({ ...t, order: i + 1 }));
  writeTrip(trip);
}

export function toggleComplete(id: string) {
  const trip = readTrip().map((t) => (t.id === id ? { ...t, completed: !t.completed } : t));
  writeTrip(trip);
}

export function clearTrip() {
  writeTrip([]);
}

export function getNextDestination(): TripItem | null {
  const trip = readTrip();
  return trip.find((t) => !t.completed) ?? null;
}

export function isTripComplete(): boolean {
  const trip = readTrip();
  return trip.length > 0 && trip.every((t) => t.completed);
}

export function getTripRoute(): { lat: number; lng: number }[] {
  return readTrip().map((t) => ({ lat: t.lat, lng: t.lng }));
}

export function onTripChange(cb: (trip: TripItem[]) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<TripItem[]>).detail);
  window.addEventListener(TRIP_EVENT, handler);
  return () => window.removeEventListener(TRIP_EVENT, handler);
}
