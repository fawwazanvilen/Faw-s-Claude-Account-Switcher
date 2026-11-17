# Chrome Web Store listing — copy/paste sheet

Everything below goes into the Developer Dashboard (https://chrome.google.com/webstore/devconsole).

## Store listing tab

**Name:** Faw's Claude Account Switcher
_(comes from `extension/manifest.json`)_

**Summary** (from manifest, 105/132 chars):
Switch between your own claude.ai accounts in one click and see usage. Encrypted, local-only. Unofficial.

**Category:** Productivity
**Language:** English

**Detailed description:**

```
Switch between your own claude.ai accounts in one click, without signing out and back in.

Unofficial. Not affiliated with or endorsed by Anthropic. "Claude" is a trademark of Anthropic.

WHAT IT DOES
• Save several claude.ai accounts and switch between them from the toolbar popup. Open claude.ai tabs reload as the chosen account.
• Shows usage limits (session and weekly) for the account you're signed in to, and the last value seen for the others. Usage is read from claude.ai's own web app and is best-effort: if claude.ai changes it, switching keeps working.
• Detects when you've signed in to a new account and offers to save it.

PRIVATE BY DESIGN
• Saved sessions are encrypted with a passphrase you choose (AES-256, PBKDF2 with 600,000 iterations). You enter it once per browser session; a Lock button forgets it sooner.
• Everything stays on your device. No servers, no analytics, no telemetry, no remote code.
• Only talks to claude.ai, and the extension's content security policy enforces that.
• Minimal permissions: cookies and storage, limited to https://claude.ai/*.
• Open source (MIT): https://github.com/fawwazanvilen/Faw-s-Claude-Account-Switcher. Read every line before you install.

HOW TO USE
1. Click the toolbar icon and create a passphrase.
2. Sign in to claude.ai as usual and click "Save account".
3. Click "+ Add account", sign in to the next account, and save it.
4. Click "Switch to this account" on any saved card.

NOTES
• Forgot your passphrase? It can't be recovered. "Forgot passphrase?" erases the saved accounts and you sign in again.
• Intended for people who legitimately use more than one account of their own.
```

**Store icon:** `store/store-icon-128.png`
**Screenshots (1280×800):** `store/screenshots/screenshot-1.png` … `screenshot-4.png`
**Small promo tile (440×280):** `store/promo-tile-440x280.png`
**Homepage URL / Support URL:** https://github.com/fawwazanvilen/Faw-s-Claude-Account-Switcher (Issues tab for support)

## Privacy practices tab

**Single purpose description:**
Let a user switch between their own claude.ai accounts in one browser profile and see each account's usage.

**Permission justifications:**

- **cookies** — Reads and restores the claude.ai session cookies of accounts the user chooses to save; this is how switching accounts works. Access is limited by host permission to https://claude.ai/*. Cookies are encrypted with the user's passphrase before being stored.
- **storage** — Stores the encrypted account vault (chrome.storage.local) and a RAM-only unlock key (chrome.storage.session) so the passphrase is typed once per browser session.
- **Host permission (https://claude.ai/\*)** — Required for the cookies API to reach claude.ai cookies, and for the popup to read the signed-in account's email address and usage numbers from claude.ai using the user's existing login. No other site is accessed.

**Remote code:** No, I am not using remote code.

**Data usage — tick:**
- [x] Personally identifiable information (the account email address, read from claude.ai and kept encrypted on-device)
- [x] Authentication information (claude.ai session cookies, kept encrypted on-device)
- [ ] everything else unticked (health, financial, personal communications, location, web history, user activity, website content)

**Certifications — tick all three:**
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/fawwazanvilen/Faw-s-Claude-Account-Switcher/blob/main/PRIVACY.md

## Test instructions (for reviewers)

```
The extension needs a claude.ai account to demonstrate. Steps: (1) Sign in to https://claude.ai. (2) Click the extension icon, create a passphrase (8+ characters) and click "Save account". (3) Click "+ Add account", sign in to a second account, open the popup and click "Save account". (4) Click "Switch to this account" on the first card; claude.ai reloads signed in as that account. No data leaves the device; the only network traffic is to claude.ai. Source: https://github.com/fawwazanvilen/Faw-s-Claude-Account-Switcher.
```

## Distribution tab

Visibility: Public. Regions: all. Pricing: free.

## Submission checklist

1. Check `PRIVACY.md` and `LICENSE` read the way you want (contact is via GitHub Issues; no email is published).
2. Load `extension/` unpacked in Chrome and test (switch, lock/unlock, usage). Fix anything odd before submitting.
3. Run `bash scripts/package.sh` and upload `dist/faw-claude-account-switcher-<version>.zip`.
4. Complete Store listing, Privacy practices and Distribution tabs from this sheet, then "Submit for review".
5. For each update, bump `version` in `extension/manifest.json`, re-run the package script and upload the new zip.
