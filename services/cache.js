// services/cache.js — Cache en mémoire avec TTL
const store = new Map();

function set(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { store.delete(key); return null; }
  return entry.value;
}

function del(key) { store.delete(key); }

// Retourne la valeur en cache ou appelle fn() pour la remplir
async function getOrSet(key, fn, ttlMs) {
  const cached = get(key);
  if (cached !== null) return cached;
  const value = await fn();
  if (value !== null && value !== undefined) set(key, value, ttlMs);
  return value;
}

module.exports = { set, get, del, getOrSet };
