// Encrypted vault for saved sessions.
//
//   passphrase --PBKDF2-SHA256 (600k, random salt)--> AES-GCM-256 key
//   storage.local = { vault: {v, salt, iter}, blob: {iv, ct} }   (blob = encrypted {profiles, activeId})
//
// The derived key is kept in memory and mirrored to storage.session (RAM only, cleared when the
// browser closes) so you type the passphrase once per browser session, or after pressing Lock.
// Encryption protects the saved sessions at rest (disk, backups, a copied profile folder).
// It does not protect against malware already running as you while the vault is unlocked.

const ITER = 600000;
const te = new TextEncoder();
const td = new TextDecoder();

let memKey = null;

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pass, salt, iter) {
  const base = await crypto.subtle.importKey("raw", te.encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function encrypt(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

async function decrypt(key, blob) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, key, unb64(blob.ct));
  return JSON.parse(td.decode(pt));
}

async function cacheKey(key, api) {
  memKey = key;
  if (api.storage.session) {
    const raw = await crypto.subtle.exportKey("raw", key);
    await api.storage.session.set({ k: b64(raw) });
  }
}

export function newId() {
  return crypto.randomUUID();
}

// "uninitialized" | "locked" | "unlocked"
export async function status(api = chrome) {
  const { vault } = await api.storage.local.get("vault");
  if (!vault) return "uninitialized";
  if (memKey) return "unlocked";
  if (api.storage.session) {
    const { k } = await api.storage.session.get("k");
    if (k) {
      memKey = await crypto.subtle.importKey("raw", unb64(k), "AES-GCM", true, ["encrypt", "decrypt"]);
      return "unlocked";
    }
  }
  return "locked";
}

// Pre-vault (v0.1) plaintext data, if any, so it can be migrated into the vault.
export async function legacyState(api = chrome) {
  const { profiles, activeId } = await api.storage.local.get(["profiles", "activeId"]);
  return Array.isArray(profiles) && profiles.length ? { profiles, activeId: activeId ?? null } : null;
}

export async function setup(pass, initial = { profiles: [], activeId: null }, api = chrome) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(pass, salt, ITER);
  const blob = await encrypt(key, initial);
  await api.storage.local.set({ vault: { v: 1, salt: b64(salt), iter: ITER }, blob });
  await api.storage.local.remove(["profiles", "activeId"]); // drop any plaintext leftovers
  await cacheKey(key, api);
}

export async function unlock(pass, api = chrome) {
  const { vault, blob } = await api.storage.local.get(["vault", "blob"]);
  if (!vault || !blob) throw new Error("No vault");
  const key = await deriveKey(pass, unb64(vault.salt), vault.iter);
  try {
    await decrypt(key, blob);
  } catch {
    throw new Error("Wrong passphrase");
  }
  await cacheKey(key, api);
}

export async function load(api = chrome) {
  if (!memKey) throw new Error("Vault is locked");
  const { blob } = await api.storage.local.get("blob");
  return decrypt(memKey, blob);
}

export async function save(state, api = chrome) {
  if (!memKey) throw new Error("Vault is locked");
  const blob = await encrypt(memKey, { profiles: state.profiles, activeId: state.activeId });
  await api.storage.local.set({ blob });
}

export async function lock(api = chrome) {
  memKey = null;
  if (api.storage.session) await api.storage.session.remove("k");
}

// Forgotten passphrase: wipes saved sessions (you just sign in to each account again).
export async function reset(api = chrome) {
  await lock(api);
  await api.storage.local.remove(["vault", "blob", "profiles", "activeId"]);
}

// Test hook: simulate a fresh popup (memory gone, session storage intact).
export function _dropMemoryKey() {
  memKey = null;
}
