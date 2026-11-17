# Faw's Claude Account Switcher

Switch between your own claude.ai accounts in one click, and see usage limits. Encrypted, local-only, open source.

> **Unofficial.** Not affiliated with or endorsed by Anthropic. "Claude" is a trademark of Anthropic.

## Install

- **Chrome Web Store:** _link goes here once published._
- **From source (no auto-updates):** `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → choose the `extension/` folder.

## Use

1. Click the toolbar icon and create a passphrase (8+ characters; it cannot be recovered). You type it once per browser session; **Lock** forgets it sooner.
2. Sign in to claude.ai normally, open the popup, click **Save account**.
3. **+ Add account** signs this browser out locally (the saved session is kept) and opens the login page. Sign in to the next account, open the popup, **Save account**.
4. Click **Switch to this account** on any card. claude.ai tabs reload as that account.

## What it can touch

- Permissions: `cookies` and `storage`, plus host access to `https://claude.ai/*` only. No `tabs`, no `<all_urls>`, no background script, no content scripts.
- The popup's content security policy is `connect-src https://claude.ai`, so it cannot send data to any other host.
- Saved sessions are encrypted at rest: PBKDF2-SHA256 (600k iterations) → AES-GCM-256, in `chrome.storage.local`. The unlocked key lives in memory and `storage.session` (RAM only), never on disk.
- That protects a copied profile folder or backup. It does not protect against malware running as you while the vault is unlocked, and the account you're currently signed in as is in Chrome's normal cookie store like any login.
- No export feature, no analytics, no remote code. See [PRIVACY.md](PRIVACY.md).

## Audit it in two minutes

```sh
grep -rnE "fetch\(|fetchFn\(|XMLHttp|WebSocket|eval\(|new Function|innerHTML|sendBeacon" extension/
```

Only `extension/lib/claude.js` makes network calls, all to `https://claude.ai` paths.

## Known limits

- Usage reads claude.ai's own web endpoints (unofficial; they may change). If a card says "Usage unavailable (…)", switching still works.
- Usage is live for the active account only; other cards show the last value seen, with its age.

## Develop

```sh
node --test tests/*.mjs      # unit tests: cookie swap logic, encryption, usage parsing
bash scripts/package.sh         # builds dist/faw-claude-account-switcher-<version>.zip (extension files only)
```

Publishing notes and Chrome Web Store copy: [store/LISTING.md](store/LISTING.md).

## License

[MIT](LICENSE)
