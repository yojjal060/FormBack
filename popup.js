const $ = id => document.getElementById(id);
let activeTab;
let originPattern;
let pageState;

function scriptIdForOrigin(pattern) {
  let hash = 2166136261;
  for (const character of pattern) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return `formback-${(hash >>> 0).toString(36)}`;
}

function setMessage(title, copy) {
  $('status-title').textContent = title;
  $('status-copy').textContent = copy;
}

async function registerForSite() {
  const id = scriptIdForOrigin(originPattern);
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
  if (!existing.length) {
    await chrome.scripting.registerContentScripts([{
      id,
      matches: [originPattern],
      js: ['content.js'],
      runAt: 'document_idle',
      persistAcrossSessions: true
    }]);
  }
  await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['content.js'] });
}

async function send(type) {
  if (!activeTab?.id) return null;
  try { return await chrome.tabs.sendMessage(activeTab.id, { type }); }
  catch { return null; }
}

async function refresh() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  let pageUrl;
  try { pageUrl = new URL(tab.url); } catch { pageUrl = null; }

  if (!pageUrl || !['http:', 'https:'].includes(pageUrl.protocol)) {
    $('site').textContent = 'Unsupported page';
    $('enable-site').hidden = true;
    $('actions').hidden = true;
    $('delete').hidden = true;
    setMessage('Open a website', 'FormBack can run on regular HTTP and HTTPS pages.');
    return;
  }

  $('site').textContent = pageUrl.hostname;
  originPattern = `${pageUrl.origin}/*`;
  const granted = await chrome.permissions.contains({ origins: [originPattern] });
  $('enable-site').hidden = granted;
  $('actions').hidden = !granted;

  if (!granted) {
    $('delete').hidden = true;
    setMessage('Enable this site', 'FormBack only reads fields on sites you enable. Drafts stay in local extension storage.');
    return;
  }

  try {
    await registerForSite();
    pageState = await send('FORMBACK_STATUS');
  } catch {
    setMessage('Refresh this page', 'FormBack has site access. Refresh the page to attach its form helper.');
    return;
  }

  const hasFields = (pageState?.fields || 0) > 0;
  $('save').disabled = !hasFields;
  $('restore').disabled = !pageState?.draft;
  $('delete').hidden = !pageState?.draft;
  if (pageState?.draft) {
    setMessage('Draft ready', `Autosaved on this device · ${pageState.steps} step${pageState.steps === 1 ? '' : 's'} recorded.`);
    $('draft-state').textContent = `Saved ${new Date(pageState.updatedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}`;
  } else if (hasFields) {
    setMessage('Autosave is on', 'Safe fields save as you edit. Passwords, codes, payment fields and uploads are skipped.');
    $('draft-state').textContent = 'No draft yet';
  } else {
    setMessage('No form fields found', 'Open the form step you want to save, then use FormBack on that page.');
    $('draft-state').textContent = 'No supported fields';
  }
}

async function enableSite() {
  $('enable-site').disabled = true;
  try {
    const granted = await chrome.permissions.request({ origins: [originPattern] });
    if (!granted) {
      setMessage('Site access not granted', 'FormBack did not read or save anything on this site.');
      return;
    }
    await refresh();
  } catch {
    setMessage('Could not enable this site', 'Try opening FormBack again from the page toolbar.');
  } finally { $('enable-site').disabled = false; }
}

async function act(type) {
  const response = await send(type);
  if (!response?.ok) {
    setMessage('Could not complete that action', response?.message || 'Refresh this page and try again.');
    return;
  }
  await refresh();
  if (type === 'FORMBACK_SAVE') setMessage('Checkpoint saved', response.message);
  if (type === 'FORMBACK_RESTORE') {
    setMessage('Draft restored', `${response.message} The saved copy stays here until you delete it.`);
    $('draft-state').textContent = 'Restored · saved copy kept';
  }
  if (type === 'FORMBACK_DELETE') setMessage('Draft deleted', response.message);
}

$('enable-site').addEventListener('click', enableSite);
$('save').addEventListener('click', () => act('FORMBACK_SAVE'));
$('restore').addEventListener('click', () => act('FORMBACK_RESTORE'));
$('delete').addEventListener('click', () => act('FORMBACK_DELETE'));
refresh().catch(() => setMessage('FormBack could not start', 'Close this popup and open it again.'));
