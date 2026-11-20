// Logica delle cassette: stessa del programma per Windows (scadenze, reintegro, periodi dei controlli).
import { CASSETTE_INIZIALI } from './dati-iniziali.js';

export const CADENZE = { 1: 'mensile', 2: 'bimestrale', 3: 'trimestrale', 4: 'quadrimestrale', 6: 'semestrale', 12: 'annuale' };
const CHIAVE = 'ps_dati';

export function datiIniziali() {
  return { sites: JSON.parse(JSON.stringify(CASSETTE_INIZIALI)), history: [], settings: {} };
}
export function carica() {
  try {
    const d = JSON.parse(localStorage.getItem(CHIAVE) || 'null');
    if (d && d.sites && typeof d.sites === 'object') { d.history ||= []; d.settings ||= {}; return d; }
  } catch { /* niente */ }
  return datiIniziali();
}
export function salva(db) {
  try { localStorage.setItem(CHIAVE, JSON.stringify(db)); return true; } catch { return false; }
}
/** Accetta sia una copia fatta da questa app sia l'archivio del programma per Windows. */
export function normalizza(d) {
  if (!d || typeof d !== 'object' || !d.sites || typeof d.sites !== 'object') throw new Error('Il file non contiene cassette.');
  const sites = {};
  for (const [k, arr] of Object.entries(d.sites)) {
    if (!Array.isArray(arr)) continue;
    sites[String(k).trim().toUpperCase()] = arr.filter((x) => x && x.articolo).map((x) => ({
      articolo: String(x.articolo).trim(), richiesta: Math.max(0, Number(x.richiesta) || 0),
      disponibile: typeof x.disponibile === 'number' ? x.disponibile : (String(x.disponibile).toLowerCase() === 'manca' ? 0 : Number(x.disponibile) || 0),
      scadenza: String(x.scadenza ?? '/').trim() || '/',
    }));
  }
  if (!Object.keys(sites).length) throw new Error('Il file non contiene cassette.');
  return { sites, history: Array.isArray(d.history) ? d.history : [], settings: d.settings && typeof d.settings === 'object' ? d.settings : {} };
}

export const oggiIso = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
export const dataIta = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '—'); };
export const dataLunga = (d) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
export const nomeSede = (k) => String(k).toLowerCase().replace(/(^|[\s.\-])([a-zà-ÿ])/g, (m, a, b) => a + b.toUpperCase());

/* ---------- periodi dei controlli ---------- */
export function mesiCadenza(db) { const n = Number(db.settings.cadenza); return CADENZE[n] ? n : 3; }
function riferimento(db) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(db.settings.dataRiferimento || ''));
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : { y: 2026, m: 0, d: 1 };
}
function piuMesi(a, mesi) { const y = a.y + Math.floor((a.m + mesi) / 12), m = ((a.m + mesi) % 12 + 12) % 12, ult = new Date(y, m + 1, 0).getDate(); return new Date(y, m, Math.min(a.d, ult)); }
function indice(db, now) {
  const a = riferimento(db), n = mesiCadenza(db);
  let k = Math.floor(((now.getFullYear() - a.y) * 12 + (now.getMonth() - a.m)) / n);
  while (piuMesi(a, k * n) > now) k--;
  while (piuMesi(a, (k + 1) * n) <= now) k++;
  return k;
}
export const inizioPeriodo = (db, now = new Date()) => piuMesi(riferimento(db), indice(db, now) * mesiCadenza(db));
export const prossimoControllo = (db, now = new Date()) => piuMesi(riferimento(db), (indice(db, now) + 1) * mesiCadenza(db));
/** Date dei prossimi controlli (per il Calendario dell'iPhone). */
export function prossimiControlli(db, quanti = 8, now = new Date()) {
  const a = riferimento(db), n = mesiCadenza(db), k = indice(db, now), out = [];
  for (let i = 1; out.length < quanti; i++) out.push(piuMesi(a, (k + i) * n));
  return out;
}
export const controlli = (db) => (db.history || []).filter((h) => h && h.tipo !== 'uso');
export function controlloFatto(db, now = new Date()) {
  const a = riferimento(db);
  if (now < new Date(a.y, a.m, a.d)) return true;      // il primo controllo scelto deve ancora arrivare
  const inizio = inizioPeriodo(db, now);
  const keys = Object.keys(db.sites);
  return keys.length > 0 && keys.every((s) => fattaNelPeriodo(db, s, inizio));
}
export const fattaNelPeriodo = (db, s, inizio) => controlli(db).some((h) => String(h.sede || '').trim().toUpperCase() === s && h.data && new Date(h.data + 'T12:00:00') >= inizio);
export function ultimoControllo(db, s) {
  const h = controlli(db).filter((x) => String(x.sede || '').trim().toUpperCase() === s && x.data).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0];
  return h ? dataIta(h.data) : 'mai registrato';
}

/* ---------- articoli ---------- */
export const manca = (a) => Math.max(0, (Number(a.richiesta) || 0) - (typeof a.disponibile === 'number' ? a.disponibile : 0));
export function leggiScadenza(s) {
  if (!s || s === '/') return null;
  const m = String(s).trim().match(/^(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return { errata: true };
  let mo = +m[1], yr = +m[2]; if (yr < 100) yr += 2000;
  if (mo < 1 || mo > 12 || yr < 2020 || yr > 2100) return { errata: true };
  return { mese: mo, anno: yr, fine: new Date(yr, mo, 0, 23, 59, 59) };
}
/** '' (nessuna data), 'Scaduto', 'Data anomala', 'In scadenza', 'Regolare' */
export function esitoScadenza(db, s) {
  const p = leggiScadenza(s);
  if (!p) return '';
  if (p.errata) return 'Data anomala';
  if (p.fine < new Date()) return 'Scaduto';
  const next = prossimoControllo(db);
  if (p.anno < next.getFullYear() || (p.anno === next.getFullYear() && p.mese <= next.getMonth() + 1)) return 'In scadenza';
  return 'Regolare';
}
export function statoArticolo(db, x) {
  const e = esitoScadenza(db, x.scadenza);
  if (e === 'Scaduto') return { testo: 'Scaduto', cls: 'c-grave' };
  if (e === 'Data anomala') return { testo: 'Data errata', cls: 'c-grave' };
  if (manca(x) > 0) return { testo: 'Da reintegrare', cls: 'c-reintegro' };
  if (e === 'In scadenza') return { testo: 'In scadenza', cls: 'c-scadenza' };
  return { testo: 'Regolare', cls: 'c-ok' };
}
export function contiSede(db, s) {
  const items = db.sites[s] || [], esiti = items.map((x) => esitoScadenza(db, x.scadenza));
  return { reintegro: items.filter((x) => manca(x) > 0).length, scaduti: esiti.filter((e) => e === 'Scaduto' || e === 'Data anomala').length, scadenza: esiti.filter((e) => e === 'In scadenza').length };
}
export function statoSede(db, s) {
  const items = db.sites[s] || [], c = contiSede(db, s);
  const richiesti = items.reduce((n, x) => n + (Number(x.richiesta) || 0), 0);
  const presenti = items.reduce((n, x) => n + Math.min(Number(x.richiesta) || 0, typeof x.disponibile === 'number' ? x.disponibile : 0), 0);
  const livello = !items.length ? 'giallo' : (c.reintegro || c.scaduti) ? 'rosso' : c.scadenza ? 'giallo' : 'verde';
  return { ...c, livello, richiesti, presenti, pct: richiesti ? presenti / richiesti * 100 : 100 };
}
/** Tutte le anomalie: reintegro e scadenze, con i pezzi da chiedere. */
export function anomalie(db) {
  const out = [];
  for (const [s, items] of Object.entries(db.sites)) {
    for (const x of items) {
      const m = manca(x);
      if (m > 0) out.push({ sede: s, articolo: x.articolo, tipo: 'reintegro', cls: 'c-reintegro', etichetta: 'REINTEGRO', dettaglio: (typeof x.disponibile === 'number' && x.disponibile > 0 ? `Presenti ${x.disponibile} su ${x.richiesta}` : 'Mancante') + ` · integrare ${m}`, pezzi: m });
      const e = esitoScadenza(db, x.scadenza);
      if (e && e !== 'Regolare') {
        const grave = e !== 'In scadenza';
        out.push({ sede: s, articolo: x.articolo, tipo: grave ? 'grave' : 'scadenza', cls: grave ? 'c-grave' : 'c-scadenza', etichetta: e === 'Data anomala' ? 'DATA ERRATA' : e === 'Scaduto' ? 'SCADUTO' : 'IN SCADENZA',
          dettaglio: `Scadenza ${x.scadenza} · ` + (e === 'Data anomala' ? 'data da correggere' : e === 'Scaduto' ? 'prodotto scaduto' : 'entro il prossimo controllo'), pezzi: Number(x.richiesta) || 0 });
      }
    }
  }
  return out;
}

/* ---------- modulo Rev.04 ---------- */
const stesso = (a, b) => String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase();
function cella(db, x) {
  if (!x) return null;
  const e = esitoScadenza(db, x.scadenza);
  if (e === 'Scaduto' || e === 'Data anomala' || e === 'In scadenza') return { integrare: Number(x.richiesta) || '', scadenza: String(x.scadenza || '') };
  const m = manca(x);
  return m > 0 ? { integrare: m } : { adeguato: true };
}
export function cassetteDelPeriodo(db) {
  const inizio = inizioPeriodo(db), keys = Object.keys(db.sites);
  const fatte = keys.filter((k) => fattaNelPeriodo(db, k, inizio));
  return fatte.length ? fatte : keys;
}
export function datiModulo(db, keys) {
  const ordine = [];
  keys.forEach((k) => (db.sites[k] || []).forEach((x) => { if (!ordine.some((n) => stesso(n, x.articolo))) ordine.push(x.articolo); }));
  const righe = ordine.map((nome) => ({ articolo: nome, celle: keys.map((k) => cella(db, (db.sites[k] || []).find((x) => stesso(x.articolo, nome)))) }));
  const ultimi = keys.map((k) => controlli(db).filter((h) => h.sede === k && h.data).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0]).filter(Boolean);
  const data = ultimi.map((h) => h.data).sort().pop();
  const addetti = [...new Set(ultimi.map((h) => String(h.addetto || '').trim()).filter(Boolean))];
  const note = ultimi.filter((h) => String(h.note || '').trim()).map((h) => (keys.length > 1 ? nomeSede(h.sede) + ': ' : '') + String(h.note).trim());
  return {
    intestazione: typeof db.settings.intestazione === 'string' ? db.settings.intestazione.trim() : '',
    sede: typeof db.settings.sedeModulo === 'string' ? db.settings.sedeModulo.trim() : "Castelnovo ne' Monti",
    cadenza: CADENZE[mesiCadenza(db)],
    cassette: keys.map((k) => { const h = ultimi.find((u) => u.sede === k); return { nome: nomeSede(k), ubicata: (h && String(h.ubicata || '').trim()) || '' }; }),
    righe, data: data ? dataIta(data) : '', addetto: addetti.join(', ') || addettoPredefinito(db), note: note.join(' · '),
  };
}
export const addettoPredefinito = (db) => typeof db.settings.addetto === 'string' ? db.settings.addetto.trim() : 'Canovi';
