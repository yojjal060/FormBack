(() => {
  const installedKey = '__formbackContentInstalled';
  if (globalThis[installedKey]) return;
  globalThis[installedKey] = true;

  const SENSITIVE = /password|passwd|passcode|otp|one.?time|verification.?code|captcha|recaptcha|payment|credit.?card|card.?number|cvv|cvc|security.?code|bank|routing|iban|file|upload|cc-(?:number|name|exp|csc)|tax.?id|national.?id/i;
  const FORM_SELECTORS = 'input,textarea,select';
  const STEP_HINT = /step|page|section|next|continue|proceed|आगामी|अर्को/i;
  const localKey = `formback:v1:${location.origin}`;
  let restoring = false;
  let saveQueue = Promise.resolve();
  let autosaveTimer;
  const getStore = async () => (await chrome.storage.local.get(localKey))[localKey] || { flows: {} };
  const setStore = value => chrome.storage.local.set({ [localKey]: value });
  const isSensitive = el => {
    const type = (el.type || '').toLowerCase();
    if (['password','file','hidden','submit','button','reset','image'].includes(type)) return true;
    const attrs = ['name','id','autocomplete','placeholder','aria-label','class','data-sensitive','data-private'].map(k => el.getAttribute?.(k) || '').join(' ');
    return SENSITIVE.test(attrs) || el.closest('[data-sensitive],[data-private],[class*="captcha" i],[id*="captcha" i],[class*="payment" i],[id*="payment" i]') !== null;
  };
  // Explicit flow labels keep demos/site adapters distinct; fallback origin flow
  // supports multi-step portals that replace their markup or pathname each step.
  const formSignature = () => document.querySelector('[data-formback-flow]')?.getAttribute('data-formback-flow') || 'default-flow';
  function hash(value) { let h = 2166136261; for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); }
  function fields() {
    return [...document.querySelectorAll(FORM_SELECTORS)].filter(el => !isSensitive(el) && !el.disabled && !el.readOnly);
  }
  function fieldKey(el, index) { return `${el.form ? [...document.forms].indexOf(el.form) : 'p'}:${el.name || el.id || `${el.tagName.toLowerCase()}-${index}`}`; }
  function snapshot() {
    const values = {};
    const safeFields = fields();
    const savedRadioGroups = new Set();
    safeFields.forEach((el, i) => {
      if (el.type === 'radio') {
        const key = fieldKey(el, i);
        if (savedRadioGroups.has(key)) return;
        savedRadioGroups.add(key);
        const group = safeFields.filter(candidate => candidate.type === 'radio' && fieldKey(candidate, safeFields.indexOf(candidate)) === key);
        values[key] = { type: 'radio', value: group.find(candidate => candidate.checked)?.value ?? null };
      }
      else if (el.type === 'checkbox') values[fieldKey(el, i)] = { type: 'checkbox', value: el.checked };
      else if (el.tagName === 'SELECT' && el.multiple) values[fieldKey(el, i)] = { type: 'multi', value: [...el.selectedOptions].map(o => o.value) };
      else values[fieldKey(el, i)] = { type: 'value', value: el.value };
    });
    return values;
  }
  async function saveStep() {
    clearTimeout(autosaveTimer);
    const captured = snapshot();
    if (!Object.keys(captured).length) return { ok: false, message: 'No safe form fields found on this page.' };
    const step = detectStep();
    const id = formSignature();
    const savedAt = Date.now();
    const write = async () => {
      const store = await getStore(), old = store.flows[id] || { steps: {} };
      // Keep values from earlier steps even when the site has replaced their DOM controls.
      old.values = { ...(old.values || {}), ...captured };
      old.steps[step] = { values: { ...old.values }, savedAt };
      old.currentStep = step; old.updatedAt = savedAt;
      store.flows[id] = old;
      await setStore(store);
    };
    const operation = saveQueue.catch(() => {}).then(write);
    saveQueue = operation.catch(() => {});
    await operation;
    return { ok: true, message: `Changes saved on this device · ${stepLabel(step)}.` };
  }
  function saveStepSoon() { saveStep().catch(() => {}); }
  function scheduleAutosave() {
    if (restoring) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveStepSoon, 250);
  }
  function stepLabel(step) { return String(step).startsWith('url-') ? 'current page' : `step ${step}`; }
  function detectStep() {
    const text = `${document.title} ${location.pathname} ${document.body.innerText.slice(0, 1800)}`;
    const explicit = document.querySelector('[data-formback-step]');
    if (explicit) return String(explicit.getAttribute('data-formback-step'));
    const patterns = [/(?:step|page| चरण|चरण)\s*(\d+)\s*(?:of|\/|बाट|मध्ये)?\s*(\d+)?/i, /(?:चरण|पृष्ठ)\s*(\d+)/i];
    for (const re of patterns) { const m = text.match(re); if (m) return m[1]; }
    const progress = document.querySelector('[aria-valuenow]');
    if (progress) return String(progress.getAttribute('aria-valuenow'));
    return `url-${hash(location.pathname)}`;
  }
  async function restore() {
    clearTimeout(autosaveTimer);
    await saveQueue;
    const store = await getStore();
    const currentId = formSignature();
    const flow = store.flows[currentId];
    if (!flow) return { ok: false };
    const step = detectStep(), saved = flow.steps[step] || flow.steps[flow.currentStep] || { values: flow.values || {} };
    if (!saved) return { ok: false, message: 'No checkpoint matches this step yet.' };
    const els = fields(); let restored = 0;
    const restoredRadioGroups = new Set();
    restoring = true;
    try {
      els.forEach((el, i) => {
        const record = saved.values[fieldKey(el, i)]; if (!record) return;
        if (record.type === 'radio') {
          const key = fieldKey(el, i);
          if (restoredRadioGroups.has(key)) return;
          restoredRadioGroups.add(key);
          const group = els.filter((candidate, index) => candidate.type === 'radio' && fieldKey(candidate, index) === key);
          group.forEach(candidate => { candidate.checked = record.value !== null && candidate.value === record.value; });
          restored += group.length;
        }
        else if (record.type === 'checkbox') { el.checked = !!record.value; restored++; }
        else if (record.type === 'multi') { [...el.options].forEach(o => o.selected = record.value.includes(o.value)); restored++; }
        else if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === record.value)) return;
        else { el.value = record.value; restored++; }
      });
      // Do not dispatch input/change or submit events. Portal handlers can treat those as
      // user actions and navigate away; native values are restored quietly instead.
    } finally { setTimeout(() => { restoring = false; }, 0); }
    return { ok: true, message: `Restored ${restored} fields for ${stepLabel(step)}.` };
  }
  async function status() { await saveQueue; const store = await getStore(), flow = store.flows[formSignature()]; return flow ? { draft: true, steps: Object.keys(flow.steps).length, updatedAt: flow.updatedAt, fields: fields().length } : { draft: false, fields: fields().length }; }
  async function remove() { clearTimeout(autosaveTimer); await saveQueue; const store = await getStore(); delete store.flows[formSignature()]; await setStore(store); return { ok: true, message: 'Saved draft deleted from this device.' }; }
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    const actions = { FORMBACK_STATUS: status, FORMBACK_SAVE: saveStep, FORMBACK_RESTORE: restore, FORMBACK_DELETE: remove };
    if (actions[message?.type]) { actions[message.type]().then(respond).catch(() => respond({ ok: false })); return true; }
  });
  // Catch ordinary form submits and common next/continue controls, checkpointing before navigation.
  document.addEventListener('submit', () => { if (!restoring) saveStepSoon(); }, true);
  // Autosave after the user edits text, changes a selection, toggles a check, or
  // leaves a field. The short debounce batches keystrokes without holding data in memory long.
  document.addEventListener('input', event => { if (event.target.matches(FORM_SELECTORS)) scheduleAutosave(); }, true);
  document.addEventListener('change', event => { if (event.target.matches(FORM_SELECTORS)) { clearTimeout(autosaveTimer); saveStepSoon(); } }, true);
  document.addEventListener('focusout', event => { if (event.target.matches(FORM_SELECTORS)) { clearTimeout(autosaveTimer); saveStepSoon(); } }, true);
  document.addEventListener('click', event => {
    const button = event.target.closest('button,input[type="submit"],input[type="button"],[role="button"]');
    if (!restoring && button && STEP_HINT.test(`${button.innerText || ''} ${button.value || ''} ${button.getAttribute('aria-label') || ''}`)) saveStepSoon();
  }, true);
  window.addEventListener('formback-test-checkpoint', saveStepSoon);
  // Save a checkpoint when the page is about to be discarded, such as refresh or navigation.
  // Register a versioned flow entry without awaiting asynchronous extension storage during unload.
  window.addEventListener('pagehide', () => {
    clearTimeout(autosaveTimer);
    if (!restoring) saveStepSoon();
  });
})();
