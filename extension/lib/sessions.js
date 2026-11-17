// Cookie snapshot / clear / restore for claude.ai.
// Every function takes the `chrome` API object so it can be tested with a fake.

export const DOMAIN = "claude.ai";
export const SESSION_COOKIE = "sessionKey";

// Permission is only granted for https://claude.ai/*, so always use https.
export function cookieUrl(c) {
  const host = c.domain.replace(/^\./, "");
  return `https://${host}${c.path}`;
}

export async function hasSession(api) {
  const c = await api.cookies.get({ url: "https://claude.ai/", name: SESSION_COOKIE });
  return Boolean(c && c.value);
}

export async function snapshot(api) {
  const all = await api.cookies.getAll({ domain: DOMAIN });
  return all.map((c) => {
    const o = {
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      hostOnly: c.hostOnly,
    };
    if (!c.session && c.expirationDate) o.expirationDate = c.expirationDate;
    if (c.partitionKey) o.partitionKey = c.partitionKey;
    return o;
  });
}

export async function clear(api) {
  const all = await api.cookies.getAll({ domain: DOMAIN });
  await Promise.all(
    all.map((c) => {
      const d = { url: cookieUrl(c), name: c.name };
      if (c.partitionKey) d.partitionKey = c.partitionKey;
      return api.cookies.remove(d);
    })
  );
}

// Returns { restored, skipped, failed } so the UI can tell if the login cookie made it.
export async function restore(api, saved, nowSec = Date.now() / 1000) {
  const out = { restored: 0, skipped: 0, failed: [] };
  for (const c of saved) {
    if (c.expirationDate && c.expirationDate <= nowSec) {
      out.skipped++;
      continue;
    }
    const d = {
      url: cookieUrl(c),
      name: c.name,
      value: c.value,
      path: c.path,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
    };
    if (!c.hostOnly) d.domain = c.domain;
    if (c.expirationDate) d.expirationDate = c.expirationDate;
    if (c.partitionKey) d.partitionKey = c.partitionKey;
    try {
      const res = await api.cookies.set(d);
      if (res) out.restored++;
      else out.failed.push(c.name);
    } catch {
      out.failed.push(c.name);
    }
  }
  return out;
}

export function hasLoginCookie(saved, nowSec = Date.now() / 1000) {
  return saved.some(
    (c) => c.name === SESSION_COOKIE && c.value && (!c.expirationDate || c.expirationDate > nowSec)
  );
}
