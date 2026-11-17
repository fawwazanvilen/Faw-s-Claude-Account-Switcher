import test from "node:test";
import assert from "node:assert/strict";
import * as store from "../extension/lib/store.js";

function fakeArea() {
  const m = new Map();
  return {
    m,
    async get(keys) {
      const ks = typeof keys === "string" ? [keys] : keys;
      return Object.fromEntries(ks.filter((k) => m.has(k)).map((k) => [k, structuredClone(m.get(k))]));
    },
    async set(o) { for (const [k, v] of Object.entries(o)) m.set(k, structuredClone(v)); },
    async remove(keys) { for (const k of [].concat(keys)) m.delete(k); },
  };
}
const fakeApi = () => ({ storage: { local: fakeArea(), session: fakeArea() } });

const STATE = {
  profiles: [{ id: "1", email: "secret@example.com", cookies: [{ name: "sessionKey", value: "sk-SECRET" }] }],
  activeId: "1",
};

test("lifecycle: setup, save/load, lock, wrong pass, unlock", async () => {
  const api = fakeApi();
  assert.equal(await store.status(api), "uninitialized");
  await store.setup("correct horse battery", STATE, api);
  assert.equal(await store.status(api), "unlocked");
  assert.deepEqual(await store.load(api), STATE);

  const next = { ...STATE, activeId: null };
  await store.save(next, api);
  assert.deepEqual(await store.load(api), next);

  await store.lock(api);
  assert.equal(await store.status(api), "locked");
  await assert.rejects(store.load(api), /locked/);
  await assert.rejects(store.unlock("wrong pass", api), /Wrong passphrase/);
  assert.equal(await store.status(api), "locked");
  await store.unlock("correct horse battery", api);
  assert.deepEqual(await store.load(api), next);
});

test("nothing sensitive is stored in plaintext", async () => {
  const api = fakeApi();
  await store.setup("correct horse battery", STATE, api);
  const dump = JSON.stringify([...api.storage.local.m.entries()]);
  assert.ok(!dump.includes("sk-SECRET"));
  assert.ok(!dump.includes("secret@example.com"));
  assert.ok(!api.storage.local.m.has("profiles"));
});

test("session cache resumes a fresh popup; lock clears it", async () => {
  const api = fakeApi();
  await store.setup("correct horse battery", STATE, api);
  store._dropMemoryKey(); // new popup: module memory gone, storage.session still there
  assert.equal(await store.status(api), "unlocked");
  assert.deepEqual(await store.load(api), STATE);
  await store.lock(api);
  store._dropMemoryKey();
  assert.equal(await store.status(api), "locked");
});

test("tampered ciphertext is rejected", async () => {
  const api = fakeApi();
  await store.setup("correct horse battery", STATE, api);
  const blob = api.storage.local.m.get("blob");
  const ct = Buffer.from(blob.ct, "base64");
  ct[0] ^= 1;
  api.storage.local.m.set("blob", { iv: blob.iv, ct: ct.toString("base64") });
  await assert.rejects(store.load(api));
});

test("setup migrates legacy plaintext and removes it; reset wipes", async () => {
  const api = fakeApi();
  await api.storage.local.set({ profiles: STATE.profiles, activeId: "1" });
  const legacy = await store.legacyState(api);
  assert.equal(legacy.profiles.length, 1);
  await store.setup("correct horse battery", legacy, api);
  assert.equal(await store.legacyState(api), null);
  assert.deepEqual((await store.load(api)).profiles, STATE.profiles);
  await store.reset(api);
  assert.equal(await store.status(api), "uninitialized");
});

test("works with no storage.session (older Chrome)", async () => {
  const api = { storage: { local: fakeArea() } };
  await store.setup("correct horse battery", STATE, api);
  assert.equal(await store.status(api), "unlocked");
  await store.lock(api);
  assert.equal(await store.status(api), "locked");
});
