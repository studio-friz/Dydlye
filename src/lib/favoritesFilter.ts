type Listener = (active: boolean) => void;
const listeners = new Set<Listener>();

let active = false;

export function isFavoritesFilterActive(): boolean {
  return active;
}

export function toggleFavoritesFilter(): boolean {
  active = !active;
  broadcast();
  return active;
}

export function setFavoritesFilter(value: boolean): void {
  active = value;
  broadcast();
}

export function onFavoritesFilterChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function broadcast(): void {
  for (const fn of listeners) {
    try {
      fn(active);
    } catch {
      /* ignore */
    }
  }
}
