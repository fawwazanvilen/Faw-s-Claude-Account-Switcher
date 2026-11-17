// Read-only calls to claude.ai using the browser's current session.
// These are claude.ai's own web-app endpoints (not a public API), so they can change;
// everything here fails soft and switching never depends on it.

const BASE = "https://claude.ai";

async function getJson(path, fetchFn = fetch) {
  const r = await fetchFn(BASE + path, {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

export async function getAccount(fetchFn = fetch) {
  let a;
  try {
    a = await getJson("/api/account", fetchFn);
  } catch {
    const b = await getJson("/api/bootstrap", fetchFn);
    a = b.account || {};
  }
  const email = a.email_address || a.email;
  if (!email) throw new Error("no email in account response");
  return { email, name: a.full_name || a.display_name || "" };
}

const LABELS = {
  five_hour: "Session (5 hr)",
  seven_day: "Weekly",
  seven_day_opus: "Weekly · Opus",
  seven_day_sonnet: "Weekly · Sonnet",
};

function prettify(key) {
  return LABELS[key] || key.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());
}

// Turns whatever the usage endpoint returns into [{key,label,pct,resetsAt}].
// Any top-level object with a numeric `utilization` counts as a meter.
export function normalizeUsage(raw) {
  if (!raw || typeof raw !== "object") return [];
  const meters = [];
  for (const [key, v] of Object.entries(raw)) {
    if (v && typeof v === "object" && typeof v.utilization === "number") {
      meters.push({
        key,
        label: prettify(key),
        pct: Math.max(0, Math.min(100, Math.round(v.utilization))),
        resetsAt: v.resets_at || null,
      });
    }
  }
  const order = Object.keys(LABELS);
  meters.sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return meters;
}

export async function getUsage(fetchFn = fetch) {
  const orgs = await getJson("/api/organizations", fetchFn);
  if (!Array.isArray(orgs) || !orgs.length) throw new Error("no organizations");
  const org =
    orgs.find((o) => Array.isArray(o.capabilities) && o.capabilities.includes("chat")) || orgs[0];
  const raw = await getJson(`/api/organizations/${org.uuid}/usage`, fetchFn);
  return normalizeUsage(raw);
}
