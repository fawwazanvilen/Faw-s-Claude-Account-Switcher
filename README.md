# Faw's Claude Account Switcher

Switch between your own claude.ai accounts in one click. See usage. Encrypted, local, open source.

> Unofficial. Not affiliated with or endorsed by Anthropic.

## Install

- **Chrome Web Store:** soon.
- **From source:** `chrome://extensions` → Developer mode → Load unpacked → `extension/`.

## Use

Create a passphrase. Sign in to claude.ai and **Save account**. Use **Add account** for the next one, then **Switch** on any card.

## Security

- Permissions: `cookies`, `storage`, and `https://claude.ai/*`. Nothing else.
- The content security policy only allows connections to claude.ai.
- Sessions are encrypted at rest (PBKDF2, 600k rounds → AES-GCM-256). The key lives in memory, never on disk.
- No analytics, no remote code. See [PRIVACY.md](PRIVACY.md).
- It can't protect you from malware running as you while the vault is unlocked.

## Notes

Usage reads claude.ai's own web endpoints, which may change. Switching never depends on it.

## Develop

```sh
node --test tests/*.mjs
bash scripts/package.sh
```

Store listing copy: [store/LISTING.md](store/LISTING.md)

MIT
