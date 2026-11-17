import test from "node:test";
import assert from "node:assert/strict";
import { snapshot, clear, restore, hasLoginCookie, cookieUrl } from "../extension/lib/sessions.js";
import { normalizeUsage, getAccount, getUsage } from "../extension/lib/claude.js";

// Minimal fake of chrome.cookies backed by a Map.
function fakeChrome(initial) {
  const jar = new Map();
  const key = (c) => `${c.name}|${c.domain}|${c.path}`;
  for (const c of initial) jar.set(key(c), { session: !c.expirationDate, ...c });
  return {
    jar,
    cookies: {
      async getAll({ domain }) {
        return [...jar.values()].filter((c) => c.domain.replace(/^\./, "").endsWith(domain));
      },
      async get({ name }) {
        return [...jar.values()].find((c) => c.name === name) || null;
      },
      async remove({ url, name }) {
        const host = new URL(url).hostname;
        for (const [k, c] of jar) if (c.name === name && c.domain.replace(/^\./, "") === host) jar.delete(k);
      },
      async set(d) {
        const host = new URL(d.url).hostname;
        const domain = d.domain ?? host; // hostOnly cookie => domain == host
        const c = {
          name: d.name, value: d.value, domain, path: d.path, secure: d.secure,
          httpOnly: d.httpOnly, sameSite: d.sameSite, hostOnly: d.domain === undefined,
          session: !d.expirationDate, expirationDate: d.expirationDate,
        };
        jar.set(`${c.name}|${c.domain}|${c.path}`, c);
        return c;
      },
    },
  };
}

const FUTURE = Date.now() / 1000 + 86400;
const A = [
  { name: "sessionKey", value: "sk-A", domain: "claude.ai", path: "/", secure: true, httpOnly: true, sameSite: "lax", hostOnly: true, expirationDate: FUTURE },
  { name: "lastActiveOrg", value: "org-A", domain: ".claude.ai", path: "/", secure: true, httpOnly: false, sameSite: "lax", hostOnly: false, expirationDate: FUTURE },
  { name: "sess", value: "s", domain: "claude.ai", path: "/", secure: true, httpOnly: false, sameSite: "lax", hostOnly: true },
];

test("cookieUrl strips leading dot and always uses https", () => {
  assert.equal(cookieUrl({ domain: ".claude.ai", path: "/x" }), "https://claude.ai/x");
});

test("snapshot -> clear -> restore round-trips cookies", async () => {
  const api = fakeChrome(A);
  const snap = await snapshot(api);
  assert.equal(snap.length, 3);
  await clear(api);
  assert.equal(api.jar.size, 0);
  const res = await restore(api, snap);
  assert.equal(res.restored, 3);
  assert.equal(api.jar.get("sessionKey|claude.ai|/").value, "sk-A");
  assert.equal(api.jar.get("lastActiveOrg|.claude.ai|/").hostOnly, false);
});

test("switching A -> B leaves only B's cookies", async () => {
  const B = [{ ...A[0], value: "sk-B" }];
  const api = fakeChrome(A);
  const snapB = B;
  await clear(api);
  await restore(api, snapB);
  assert.equal(api.jar.size, 1);
  assert.equal(api.jar.get("sessionKey|claude.ai|/").value, "sk-B");
});

test("expired cookies are skipped, and hasLoginCookie notices", async () => {
  const stale = [{ ...A[0], expirationDate: 1 }];
  const api = fakeChrome([]);
  const res = await restore(api, stale);
  assert.equal(res.skipped, 1);
  assert.equal(api.jar.size, 0);
  assert.equal(hasLoginCookie(stale), false);
  assert.equal(hasLoginCookie(A), true);
});

test("a failing cookie is reported, not thrown", async () => {
  const api = fakeChrome([]);
  api.cookies.set = async () => { throw new Error("nope"); };
  const res = await restore(api, A);
  assert.deepEqual(res.failed.sort(), ["lastActiveOrg", "sess", "sessionKey"]);
});

test("normalizeUsage picks meters, clamps, orders", () => {
  const out = normalizeUsage({
    seven_day: { utilization: 41.6, resets_at: "2026-11-20T00:00:00Z" },
    five_hour: { utilization: 120, resets_at: null },
    extra_usage: null,
    seven_day_opus: { utilization: 3 },
    note: "ignore me",
  });
  assert.deepEqual(out.map((m) => [m.key, m.pct]), [["five_hour", 100], ["seven_day", 42], ["seven_day_opus", 3]]);
  assert.deepEqual(normalizeUsage(null), []);
});

test("getAccount falls back to bootstrap; getUsage picks chat org", async () => {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    const ok = (j) => ({ ok: true, json: async () => j });
    if (url.endsWith("/api/account")) return { ok: false, status: 404 };
    if (url.endsWith("/api/bootstrap")) return ok({ account: { email_address: "a@x.com" } });
    if (url.endsWith("/api/organizations")) return ok([{ uuid: "o1", capabilities: ["api"] }, { uuid: "o2", capabilities: ["chat"] }]);
    if (url.endsWith("/o2/usage")) return ok({ five_hour: { utilization: 10, resets_at: null } });
    return { ok: false, status: 500 };
  };
  assert.equal((await getAccount(fetchFn)).email, "a@x.com");
  const u = await getUsage(fetchFn);
  assert.equal(u[0].pct, 10);
  assert.ok(calls.some((c) => c.includes("/organizations/o2/usage")));
});
