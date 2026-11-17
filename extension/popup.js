import { hasSession, snapshot, clear, restore, hasLoginCookie } from "./lib/sessions.js";
import { getAccount, getUsage } from "./lib/claude.js";
import * as vault from "./lib/store.js";

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  Object.assign(n, props);
  for (const k of kids) n.append(k);
  return n;
};

let state = { profiles: [], activeId: null };
let unsaved = null; // { email, name } for a signed-in session we haven't saved
let signedIn = false;
let removing = null; // id awaiting a second click to confirm removal

function notice(msg, isError = false) {
  const n = $("notice");
  n.hidden = !msg;
  n.textContent = msg || "";
  n.className = "notice" + (isError ? " error" : "");
}

function ago(ts) {
  if (!ts) return "never";
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} hr ago` : `${Math.round(h / 24)} d ago`;
}

function resetsIn(iso) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return "resets soon";
  const m = Math.round(ms / 60000);
  if (m < 60) return `resets in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `resets in ${h}h ${m % 60}m`;
  return `resets in ${Math.round(h / 24)}d`;
}

function meterNode(m) {
  const level = m.pct >= 90 ? "bad" : m.pct >= 70 ? "warn" : "";
  const fill = el("div", { className: "fill " + level });
  fill.style.width = m.pct + "%";
  return el(
    "div",
    {},
    el(
      "div",
      { className: "meter-top" },
      el("span", { textContent: `${m.label} · ${m.pct}%` }),
      el("span", { textContent: resetsIn(m.resetsAt) })
    ),
    el("div", { className: "bar" }, fill)
  );
}

function render() {
  $("add").disabled = Boolean(unsaved);
  $("add").title = unsaved ? "Save the current session first" : "";

  const u = $("unsaved");
  u.hidden = !unsaved;
  u.replaceChildren();
  if (unsaved) {
    u.append(
      el("div", { textContent: "This browser is signed in to an account you haven't saved:" }),
      el("div", { className: "email", textContent: unsaved.email }),
      el(
        "div",
        { className: "row" },
        el("span", { className: "muted", textContent: "Save it to be able to switch back." }),
        el("button", { textContent: "Save account", onclick: saveCurrent })
      )
    );
  }

  const ul = $("accounts");
  ul.replaceChildren();
  if (!state.profiles.length && !unsaved) {
    ul.append(
      el("li", { className: "muted", textContent: signedIn ? "Loading…" : "No saved accounts. Sign in to claude.ai, then open this popup." })
    );
  }
  for (const p of state.profiles) {
    const isActive = p.id === state.activeId;
    const card = el("li", { className: "card" + (isActive ? " active" : "") });
    card.append(
      el(
        "div",
        { className: "row" },
        el("div", { className: "email", textContent: p.email, title: p.email }),
        isActive ? el("span", { className: "badge", textContent: "ACTIVE" }) : ""
      )
    );
    if (p.usage && p.usage.length) {
      const meters = el("div", { className: "meters" });
      for (const m of p.usage) meters.append(meterNode(m));
      meters.append(el("div", { className: "muted", textContent: `Usage as of ${ago(p.usageAt)}` }));
      card.append(meters);
    } else {
      card.append(
        el("div", {
          className: "muted",
          textContent: p.usageAt
            ? `Usage unavailable${p.usageError ? ` (${p.usageError})` : ""}`
            : "No usage fetched yet",
        })
      );
    }
    const actions = el("div", { className: "actions" });
    actions.append(
      isActive
        ? el("span", {})
        : el("button", { textContent: "Switch to this account", onclick: () => switchTo(p.id) }),
      el("button", {
        className: "link",
        textContent: removing === p.id ? "Click again to remove" : "Remove",
        onclick: () => remove(p.id),
      })
    );
    card.append(actions);
    ul.append(card);
  }
}

const persist = () => vault.save(state);

async function refreshUsageFor(profile) {
  try {
    profile.usage = await getUsage();
    profile.usageError = null;
  } catch (e) {
    profile.usage = profile.usage || [];
    profile.usageError = String(e.message || e);
  }
  profile.usageAt = Date.now();
}

// Figure out who the browser is signed in as and keep that profile's cookies fresh.
async function detect() {
  signedIn = await hasSession(chrome);
  unsaved = null;
  if (!signedIn) {
    state.activeId = null;
    return;
  }
  let acct;
  try {
    acct = await getAccount();
  } catch {
    notice("Signed in, but couldn't read the account from claude.ai. Switching still works for saved accounts.", true);
    return;
  }
  const match = state.profiles.find((p) => p.email.toLowerCase() === acct.email.toLowerCase());
  if (match) {
    match.cookies = await snapshot(chrome); // keeps rotated tokens up to date
    state.activeId = match.id;
  } else {
    state.activeId = null;
    unsaved = acct;
  }
}

async function saveCurrent() {
  if (!unsaved) return;
  const p = {
    id: vault.newId(),
    email: unsaved.email,
    name: unsaved.name,
    cookies: await snapshot(chrome),
    usage: [],
    usageAt: null,
    savedAt: Date.now(),
  };
  state.profiles.push(p);
  state.activeId = p.id;
  unsaved = null;
  await refreshUsageFor(p);
  await persist();
  render();
}

async function reloadClaudeTabs() {
  const tabs = await chrome.tabs.query({ url: "https://claude.ai/*" });
  if (!tabs.length) {
    await chrome.tabs.create({ url: "https://claude.ai/" });
    return;
  }
  await Promise.all(tabs.map((t) => chrome.tabs.reload(t.id)));
}

async function switchTo(id) {
  const target = state.profiles.find((p) => p.id === id);
  if (!target) return;
  if (unsaved) {
    notice(`Save ${unsaved.email} first, otherwise switching will sign it out.`, true);
    return;
  }
  if (!hasLoginCookie(target.cookies)) {
    notice("That saved session has expired. Remove it and sign in again.", true);
    return;
  }
  notice("Switching…");
  await persist(); // current profile's fresh cookies were captured in detect()
  await clear(chrome);
  const res = await restore(chrome, target.cookies);
  if (res.failed.includes("sessionKey")) {
    notice("Couldn't restore the login cookie. Try again.", true);
    return;
  }
  state.activeId = id;
  await persist();
  await reloadClaudeTabs();
  window.close();
}

async function remove(id) {
  if (removing !== id) {
    removing = id;
    render();
    return;
  }
  removing = null;
  state.profiles = state.profiles.filter((p) => p.id !== id);
  if (state.activeId === id) state.activeId = null;
  await persist();
  // Browser stays signed in; it will show up as an unsaved session next time.
  await detect();
  render();
}

async function addAccount() {
  // Active profile's cookies were just captured in detect(); store them, then sign out locally.
  await persist();
  await clear(chrome);
  state.activeId = null;
  await persist();
  await chrome.tabs.create({ url: "https://claude.ai/login" });
  window.close();
}

async function refreshActiveUsage() {
  const active = state.profiles.find((p) => p.id === state.activeId);
  if (!active) return;
  await refreshUsageFor(active);
  await persist();
  render();
}

// ---- passphrase gate -------------------------------------------------------
let gateMode = "unlock";
let gateLegacy = null;
let forgotArmed = false;

function showGate(mode, legacy = null) {
  gateMode = mode;
  gateLegacy = legacy;
  forgotArmed = false;
  $("main").hidden = true;
  $("tools").hidden = true;
  $("gate").hidden = false;
  const isSetup = mode === "setup";
  $("pass2").hidden = !isSetup;
  $("forgot").hidden = isSetup;
  $("forgot").textContent = "Forgot passphrase?";
  $("gate-go").textContent = isSetup ? "Create passphrase" : "Unlock";
  $("gate-msg").textContent = isSetup
    ? legacy
      ? "Create a passphrase to encrypt your saved accounts."
      : "Create a passphrase to encrypt saved sessions on this device. It can't be recovered: if you forget it, you'll just sign in to your accounts again."
    : "Enter your passphrase to unlock your saved accounts.";
  $("pass").value = "";
  $("pass2").value = "";
  $("pass").focus();
}

async function submitGate() {
  const pass = $("pass").value;
  notice("");
  const btn = $("gate-go");
  try {
    if (gateMode === "setup") {
      if (pass.length < 8) throw new Error("Use at least 8 characters.");
      if (pass !== $("pass2").value) throw new Error("Passphrases don't match.");
      btn.disabled = true;
      btn.textContent = "Encrypting…";
      await vault.setup(pass, gateLegacy || { profiles: [], activeId: null });
    } else {
      btn.disabled = true;
      btn.textContent = "Unlocking…";
      await vault.unlock(pass);
    }
    $("pass").value = "";
    $("pass2").value = "";
    await start();
  } catch (e) {
    notice(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = gateMode === "setup" ? "Create passphrase" : "Unlock";
  }
}

async function forgot() {
  if (!forgotArmed) {
    forgotArmed = true;
    $("forgot").textContent = "Click again to erase saved accounts and start over";
    return;
  }
  await vault.reset();
  notice("Saved accounts erased. Create a new passphrase.");
  showGate("setup");
}

async function lockNow() {
  await vault.lock();
  state = { profiles: [], activeId: null };
  showGate("unlock");
}

async function start() {
  $("gate").hidden = true;
  $("main").hidden = false;
  $("tools").hidden = false;
  state = await vault.load();
  render();
  await detect();
  await persist();
  render();
  await refreshActiveUsage();
}

async function init() {
  $("add").onclick = addAccount;
  $("refresh").onclick = async () => {
    notice("");
    await refreshActiveUsage();
  };
  $("lock").onclick = lockNow;
  $("gate-go").onclick = submitGate;
  $("forgot").onclick = forgot;
  for (const id of ["pass", "pass2"]) {
    $(id).addEventListener("keydown", (e) => {
      if (e.key === "Enter") submitGate();
    });
  }
  const st = await vault.status();
  if (st === "uninitialized") showGate("setup", await vault.legacyState());
  else if (st === "locked") showGate("unlock");
  else await start();
}

init().catch((e) => notice(`Error: ${e.message}`, true));
