// Remembers this browser's order ids (not tickets, not personal data) so a returning buyer sees their
// orders straight away. Best effort: storage can be blocked, and other devices use "Find my ticket".
const KEY = "y2k_orders";

export function savedOrders(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 10) : [];
  } catch { return []; }
}

export function rememberOrder(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify([id, ...savedOrders().filter((x) => x !== id)].slice(0, 10))); } catch { /* ignore */ }
}
