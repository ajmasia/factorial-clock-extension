# Privacy Policy — Factorial Clock

Last updated: 2026-11-09 (version 0.1.12)

Factorial Clock is a browser extension that fills in your weekly time tracking in Factorial HR. It is an
independent project, not affiliated with Factorial HR. This policy explains what data the extension handles,
where it is stored and where it is sent.

## Summary

- The developer does not collect, receive or sell any data. There is no account, no analytics and no tracking.
- The extension sends your schedule only to Factorial, through your own Factorial session.
- Your settings are stored by Chrome and synced with your Chrome account; your history stays on your device.

## Data the extension handles

| Data | What it contains | Where it is stored |
| --- | --- | --- |
| Configuration | Weekly hours, work days, clock-in and lunch time ranges, split-shift days, and your Factorial employee ID (detected from your Factorial session) | `chrome.storage.sync`: in your browser, synced by Chrome with your Chrome account if sync is on |
| Exceptions | Dates and reasons you enter for holidays, vacations, sick days and special weeks | `chrome.storage.sync`, as above |
| History | The weeks you applied: dates, clock-in and clock-out times, and the identifiers and results returned by Factorial for each shift | `chrome.storage.local`: only on this device, up to the last 50 weeks |

The extension does not read or store your Factorial password or session cookies, and has no permission to
read cookies.

## Where data is sent

- **Factorial** (`app.factorialhr.com`, `api.factorialhr.com`): to read your employee ID, and to create or delete
  the shifts you choose to apply or undo. These requests use your existing Factorial session in the browser and
  are handled by Factorial under its own privacy policy.
- **Google Fonts** (`fonts.googleapis.com`, `fonts.gstatic.com`): the extension's popup loads its font from
  Google Fonts, so Google receives a standard web request (including your IP address) when the popup opens. No
  extension data is included in that request.
- Nothing is sent to the developer or to any other service.

## Permissions

- `storage`: to keep your configuration, exceptions and history.
- Access to `app.factorialhr.com` and `api.factorialhr.com`: to talk to Factorial on your behalf.

## Retention and deletion

- Delete a week from History at any time with its **Delete** button. History keeps at most the last 50 weeks.
- Change or delete exceptions and settings at any time from the extension.
- Removing the extension from Chrome deletes all the data it stored.
- Shifts created in Factorial belong to your Factorial account; delete them in Factorial or with **Undo week**.

## Children

The extension is intended for employees and is not directed at children.

## Changes

Changes to this policy are published in this file, with a new "Last updated" date.

## Contact

Questions or requests: open an issue at
https://github.com/ajmasia/factorial-clock-extension/issues
