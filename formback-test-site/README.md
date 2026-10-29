# FormBack multi-step test site

This is a plain HTML/CSS/JavaScript form with three input steps and a review screen. It sends no data to a server.

## Run it

From the project root, start a local server:

```powershell
python -m http.server 8000
```

Open <http://localhost:8000/formback-test-site/>. Load the project root as an unpacked extension in Chrome or Edge if you have not already.

## Test recovery

1. Click the FormBack toolbar icon and choose **Enable on this site**. Approve the `localhost` permission prompt. This is required once per site.
2. Fill in step 1. FormBack autosaves safe fields after a short pause. Click **Next** and fill in the later steps.
3. Reload the page and open FormBack. The extension popup shows whether a draft was saved.
4. Choose **Restore draft**. The form fields should return across the visited steps.
5. Choose **Delete saved draft** to clear FormBack's copy. The demo's **Clear demo position** only resets which step is visible.

After changing extension code, reload the extension on `chrome://extensions` or `edge://extensions`, then refresh this page.
