export type Mode = "houses" | "destinations";

const MODE_EVENT = "dydlye-mode-toggle";
const MODE_KEY = "dydlye-map-mode";

function readMode(): Mode {
  const v = window.localStorage.getItem(MODE_KEY);
  return v === "destinations" ? "destinations" : "houses";
}

function writeMode(m: Mode) {
  window.localStorage.setItem(MODE_KEY, m);
}

export function getMode(): Mode {
  return readMode();
}

export function setMode(m: Mode) {
  writeMode(m);
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: m }));
}

export function toggleMode(): Mode {
  const next = readMode() === "houses" ? "destinations" : "houses";
  setMode(next);
  return next;
}

export function onModeChange(cb: (mode: Mode) => void) {
  const handler = (e: Event) => cb((e as CustomEvent<Mode>).detail);
  window.addEventListener(MODE_EVENT, handler);
  return () => window.removeEventListener(MODE_EVENT, handler);
}
