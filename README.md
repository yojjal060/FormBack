# FormBack

FormBack is a privacy-first Manifest V3 browser extension for saving ordinary form fields locally and restoring them after a reload. It supports multi-step forms by keeping one draft across the steps it can identify.

## Install for development

1. Download or clone this folder.
2. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
3. Turn on **Developer mode** and select **Load unpacked**.
4. Choose the project folder that contains `manifest.json`.
5. Open a form and click the FormBack toolbar icon. Choose **Enable on this site** and approve the browser's site-specific permission prompt.

FormBack begins autosaving safe fields on that site after it is enabled. The permission applies to that site's origin. Enable other sites separately. You can remove site access in the browser's extension settings.

## Try the local test form

From this folder, run:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000/formback-test-site/>. Enable FormBack on `localhost`, fill a step, wait briefly, then move to the next step. Reload the page and choose **Restore draft** from the toolbar popup. The demo's current step is kept separately in the browser tab session so you can check restoring fields on that step.

## What it saves

- Text inputs, text areas, checkboxes, radio groups, and dropdowns.
- Changes are saved locally after a short typing pause, when a field changes or loses focus, and before detected step transitions.
- Restore keeps the saved copy until you choose **Delete saved draft**.
- Drafts are stored in the browser's local extension storage and are not uploaded by FormBack.

## What it skips

Passwords, one-time codes, CAPTCHA fields, payment and card/bank fields, file uploads, hidden inputs, disabled fields, read-only fields, and fields marked `data-sensitive` or `data-private` are excluded. The exclusion checks use field metadata and nearby labels; review exclusions carefully before relying on a new site.

## Known limits

- FormBack restores values on the current page; it cannot recreate progress kept only in a site's server session or bypass a site's own steps.
- Step detection uses a `data-formback-step` attribute when available, then common visible step/page labels, accessible progress values, or the current route.
- Multi-step sites with changing field names, custom widgets, cross-origin frames, or application state that requires input events may need a site-specific adapter. Restore intentionally avoids dispatching page events because some portals react to them by navigating or refreshing.
- Only the current page's main document is supported. Embedded cross-origin forms and file contents are not saved.

## Project layout

- `manifest.json`, `content.js`, `popup.*`: browser extension.
- `formback-test-site/`: dependency-free multi-step test page.

No build step or third-party JavaScript dependencies are required.
