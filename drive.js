/* Google-Drive-Synchronisierung.
   Die Daten liegen als Datei "Planer-Daten.json" in deinem Google Drive.
   Die App bekommt nur Zugriff auf Dateien, die sie selbst angelegt hat
   (Berechtigung "drive.file") – nicht auf den Rest deines Drives. */
const Drive = (() => {
  'use strict';

  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const FILE_NAME = 'Planer-Daten.json';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const LS = {
    token: 'planer.drive.token',
    fileId: 'planer.drive.fileId',
    enabled: 'planer.drive.enabled',
    clientId: 'planer.drive.clientId',
    lastSync: 'planer.drive.lastSync',
  };

  let app = null;          // { getData, setData, onState }
  let gisPromise = null;
  let tokenClient = null;
  let pendingAuth = null;
  let state = 'off';
  let detail = '';
  let running = false;
  let again = false;
  let timer = null;

  /* ---------- kleine Helfer ---------- */
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* egal */ } },
  };

  function setState(s, d = '') {
    state = s; detail = d;
    if (app && app.onState) app.onState(s, d);
  }

  function clientId() {
    return (ls.get(LS.clientId) || (window.PLANER_CONFIG && window.PLANER_CONFIG.googleClientId) || '').trim();
  }
  function setClientId(id) {
    const v = (id || '').trim();
    ls.set(LS.clientId, v || null);
    tokenClient = null;
  }
  function isEnabled() { return ls.get(LS.enabled) === '1' && !!clientId(); }

  function storedToken() {
    try {
      const t = JSON.parse(ls.get(LS.token) || 'null');
      return t && t.exp > Date.now() + 60_000 ? t.access_token : null;
    } catch { return null; }
  }
  function clearToken() { ls.set(LS.token, null); }

  /* ---------- Google-Anmeldung (Google Identity Services) ---------- */
  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new Error('Google-Anmeldung konnte nicht geladen werden (offline?)')); };
      document.head.append(s);
    });
    return gisPromise;
  }

  async function authorize(forceConsent) {
    const id = clientId();
    if (!id) throw new Error('Keine Google Client-ID eingetragen');
    await loadGis();
    if (!tokenClient) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: id,
        scope: SCOPE,
        callback: resp => {
          const p = pendingAuth; pendingAuth = null;
          if (!p) return;
          if (resp.error) return p.reject(new Error(resp.error_description || resp.error));
          ls.set(LS.token, JSON.stringify({
            access_token: resp.access_token,
            exp: Date.now() + (Number(resp.expires_in) || 3600) * 1000,
          }));
          p.resolve(resp.access_token);
        },
        error_callback: err => {
          const p = pendingAuth; pendingAuth = null;
          if (p) p.reject(new Error(err && err.type === 'popup_closed' ? 'Anmeldung abgebrochen' : 'Anmeldung fehlgeschlagen'));
        },
      });
    }
    return new Promise((resolve, reject) => {
      pendingAuth = { resolve, reject };
      tokenClient.requestAccessToken({ prompt: forceConsent ? 'consent' : '' });
    });
  }

  /* ---------- Drive-API ---------- */
  class NeedsLogin extends Error {}

  async function api(url, opts = {}) {
    const token = storedToken();
    if (!token) throw new NeedsLogin('Anmeldung abgelaufen');
    const res = await fetch(url, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, ...(opts.headers || {}) },
    });
    if (res.status === 401) { clearToken(); throw new NeedsLogin('Anmeldung abgelaufen'); }
    if (!res.ok) {
      let msg = `Drive-Fehler ${res.status}`;
      try { const j = await res.json(); if (j.error && j.error.message) msg += `: ${j.error.message}`; } catch { /* egal */ }
      const e = new Error(msg); e.status = res.status; throw e;
    }
    return res;
  }

  async function findFile() {
    const stored = ls.get(LS.fileId);
    if (stored) {
      try {
        const r = await api(`${API}/files/${encodeURIComponent(stored)}?fields=id,trashed`);
        const f = await r.json();
        if (!f.trashed) return f.id;
      } catch (e) {
        if (e instanceof NeedsLogin) throw e;
        if (e.status !== 404) throw e;
      }
      ls.set(LS.fileId, null);
    }
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const r = await api(`${API}/files?q=${q}&spaces=drive&orderBy=modifiedTime desc&fields=files(id,modifiedTime)`);
    const { files } = await r.json();
    if (files && files.length) { ls.set(LS.fileId, files[0].id); return files[0].id; }
    return null;
  }

  async function createFile(data) {
    const boundary = 'planer' + Math.random().toString(36).slice(2);
    const meta = { name: FILE_NAME, mimeType: 'application/json', description: 'Daten der Planer-App (nicht von Hand bearbeiten)' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data)}\r\n--${boundary}--`;
    const r = await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    const f = await r.json();
    ls.set(LS.fileId, f.id);
    return f.id;
  }

  async function download(id) {
    const r = await api(`${API}/files/${encodeURIComponent(id)}?alt=media`, { cache: 'no-store' });
    const text = await r.text();
    try { return JSON.parse(text || '{}'); } catch { return {}; }
  }

  async function upload(id, data) {
    await api(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  /* ---------- Synchronisieren ---------- */
  async function sync() {
    if (!isEnabled()) { setState(clientId() ? 'disconnected' : 'off'); return; }
    if (!storedToken()) { setState('login'); return; }
    if (!navigator.onLine) { setState('offline'); return; }
    if (running) { again = true; return; }
    running = true;
    setState('syncing');
    try {
      do {
        again = false;
        const id = await findFile();
        if (!id) {
          const local = app.getData();
          await createFile({ version: 2, app: 'planer', ...local });
        } else {
          const remote = await download(id);
          const merged = SyncCore.merge(app.getData(), remote);
          if (!SyncCore.same(merged, app.getData())) app.setData(merged);
          if (!SyncCore.same(merged, remote)) await upload(id, { version: 2, app: 'planer', ...merged });
        }
      } while (again);
      ls.set(LS.lastSync, String(Date.now()));
      setState('ok');
    } catch (e) {
      if (e instanceof NeedsLogin) setState('login');
      else if (!navigator.onLine) setState('offline');
      else setState('error', e.message || String(e));
    } finally {
      running = false;
    }
  }

  function schedule(delay = 1500) {
    if (!isEnabled()) return;
    clearTimeout(timer);
    timer = setTimeout(sync, delay);
  }

  async function connect() {
    if (!clientId()) throw new Error('Bitte zuerst die Google Client-ID eintragen');
    setState('syncing');
    try {
      await authorize(ls.get(LS.enabled) !== '1');
    } catch (e) {
      setState(isEnabled() ? 'login' : 'disconnected', e.message);
      throw e;
    }
    ls.set(LS.enabled, '1');
    await sync();
  }

  function disconnect() {
    const t = storedToken();
    if (t && window.google && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(t, () => {}); } catch { /* egal */ }
    }
    clearToken();
    ls.set(LS.enabled, null);
    ls.set(LS.fileId, null);
    setState(clientId() ? 'disconnected' : 'off');
  }

  function init(opts) {
    app = opts;
    sync();
    // regelmäßig abgleichen, solange die App sichtbar ist
    setInterval(() => { if (isEnabled() && !document.hidden && state !== 'login') sync(); }, 60_000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
    window.addEventListener('online', () => sync());
  }

  return {
    init, sync, schedule, connect, disconnect,
    clientId, setClientId, isEnabled,
    get state() { return state; },
    get detail() { return detail; },
    get lastSync() { const v = Number(ls.get(LS.lastSync)); return v || null; },
    get fileId() { return ls.get(LS.fileId); },
  };
})();
