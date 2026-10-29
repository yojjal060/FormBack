# Changelog

## 0.2.0

- Request site access separately for each enabled website.
- Register the helper only on approved sites and inject it on the current page.
- Autosave safe field edits locally, with a short debounce and immediate saves for selections and field changes.
- Make save writes resilient to a failed storage operation and wait for pending writes before restore or delete.
- Improve password, OTP, payment, identity, CAPTCHA, and explicitly marked sensitive-field exclusions.
- Remove remote font imports so the extension UI and demo do not fetch fonts from a third party.
- Keep radio group selection state, including an empty selection.
- Replace the earlier demo with the dedicated multi-step test site.
