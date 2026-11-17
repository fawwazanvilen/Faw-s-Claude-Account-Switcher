# Privacy Policy — Faw's Claude Account Switcher

_Last updated: 2026-11-17_

Faw's Claude Account Switcher ("the extension") lets you switch between your own claude.ai accounts in one browser. It is an unofficial, independent tool and is not affiliated with or endorsed by Anthropic.

**Short version:** everything stays on your device. The developer receives no data, there is no analytics or telemetry, and nothing is sent to any server other than claude.ai itself.

## What the extension handles

| Data | Why | Where it goes |
|---|---|---|
| claude.ai session cookies (login state) for accounts you choose to save | To restore an account's login when you switch to it | Stored on your device only, encrypted (see below) |
| The email address of each saved account | To label accounts in the popup and recognise which one you're signed in to | Read from claude.ai using your existing login; stored on your device only, encrypted |
| Usage-limit numbers shown for an account | To display usage in the popup | Read from claude.ai using your existing login; stored on your device only, encrypted |
| Your passphrase | To encrypt and unlock the above | Never stored. A key derived from it is held in memory, and in the browser's RAM-only session storage until the browser closes or you press Lock |

## How it is protected

- Saved sessions, emails and usage numbers are encrypted at rest with AES-GCM (256-bit). The key is derived from your passphrase with PBKDF2-SHA256 (600,000 iterations, random salt).
- The extension requests only the `cookies` and `storage` permissions, and host access to `https://claude.ai/*` only.
- The extension's content security policy restricts its pages to connecting to `https://claude.ai` only, so it cannot send data to any other host.
- The extension contains no analytics, no telemetry, no advertising, and loads no remote code.
- The source code is public so you can verify all of this: see the repository linked below.

## What is not done

- No data is sold, shared with, or transferred to third parties.
- No data is used for any purpose other than the extension's single purpose (switching between your own claude.ai accounts and showing their usage).
- No data is used for advertising, creditworthiness or lending decisions.
- The developer cannot read your data and cannot recover your passphrase.

## Your control

- Remove a saved account at any time from the popup; its data is deleted.
- "Forgot passphrase?" erases all saved accounts.
- Uninstalling the extension deletes all of its stored data.
- Be aware that a browser stays signed in to whichever account is active, as with any website login.

## Changes

Changes to this policy are published in this file in the public repository, with the date above updated.

## Contact

Faw — via GitHub Issues: https://github.com/fawwazanvilen/Faw-s-Claude-Account-Switcher/issues

Source code: https://github.com/fawwazanvilen/Faw-s-Claude-Account-Switcher
