// Gestione Pronto Soccorso - web app per iPhone. I dati restano nel telefono.
import * as L from './logica.js';
import { pdfModulo, pdfReintegro, calendarioIcs, leggiModulo, salvaModulo, provaModulo } from './stampa.js';

export const VERSIONE = '1.5';
let db = L.carica();
const ui = { scheda: 'oggi', sede: '', modulo: '' };
const aggiornaModulo = async () => { try { const m = await leggiModulo(); ui.modulo = m ? `${m.nome} · caricato il ${new Date(m.data).toLocaleDateString('it-IT')}` : ''; } catch { ui.modulo = ''; } };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ICO = {
  croce: '<svg viewBox="0 0 24 24"><path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5z"/></svg>',
  ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M7 7l10 10M17 7L7 17"/>', att: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>', esc: '<path d="M12 6v8M12 18v.5"/>',
  freccia: '<svg class="freccia" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  dx: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  indietro: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
  stampa: '<svg viewBox="0 0 24 24"><path d="M7 9V3h10v6"/><path d="M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/></svg>',
  foglio: '<svg viewBox="0 0 24 24"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><path d="M5 6h14v14H5z"/><path d="M5 10h14M9 3v5M15 3v5"/></svg>',
  spunta: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  piu: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  mano: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/><circle cx="12" cy="12" r="9.5"/></svg>',
};
const COLORE = { verde: 'var(--verde)', giallo: 'var(--arancio)', rosso: 'var(--rosso)' };
const ETICHETTA = { verde: 'A POSTO', giallo: 'ATTENZIONE', rosso: 'DA SISTEMARE' };
const anello = (pct, col, dentro, grande = false) => `<div class="anello${grande ? ' grande' : ''}" style="--p:${Math.round(pct)};--c:${col}"><span>${dentro}</span></div>`;
const tondo = (livello, path) => `<div class="ico-tondo" style="background:${COLORE[livello]}"><svg viewBox="0 0 24 24">${path}</svg></div>`;

function salva() { if (!L.salva(db)) avviso('Non riesco a salvare nel telefono.'); aggiornaBollino(); }
let timerAvviso;
function avviso(t) { const a = $('avviso'); a.textContent = t; a.hidden = false; clearTimeout(timerAvviso); timerAvviso = setTimeout(() => { a.hidden = true; }, 2800); }

/* ---------------- OGGI ---------------- */
function schedaCassetta(s) {
  const st = L.statoSede(db, s), segno = st.livello === 'verde' ? ICO.ok : st.livello === 'giallo' ? ICO.esc : ICO.x;
  const box = (n, t, col) => `<div><b style="color:${n ? col : 'var(--tenue)'}">${n}</b><span>${t}</span></div>`;
  return `<button class="sede" data-az="apri-sede" data-sede="${esc(s)}" style="--c:${COLORE[st.livello]}">
    <div class="sede-testa">${anello(st.pct, COLORE[st.livello], Math.round(st.pct) + '<small>%</small>')}<div><h3>${esc(L.nomeSede(s))}</h3><p>Ultimo controllo: ${esc(L.ultimoControllo(db, s))}</p></div><span class="pill" style="--c:${COLORE[st.livello]}">${ETICHETTA[st.livello]}</span></div>
    <div class="conte">${box(st.reintegro, 'da reintegrare', 'var(--arancio)')}${box(st.scaduti, st.scaduti === 1 ? 'scaduto' : 'scaduti', 'var(--rosso-t)')}${box(st.scadenza, 'in scadenza', 'var(--giallo)')}</div>
    <div class="barra"><i style="width:${st.pct}%"></i></div>
    <div class="sede-piede"><span>${st.presenti} / ${st.richiesti} pezzi presenti</span><b>Apri cassetta ${ICO.dx}</b></div></button>`;
}
function oggi() {
  const now = new Date(), fatto = L.controlloFatto(db, now), prossimo = L.prossimoControllo(db, now), keys = Object.keys(db.sites), cad = L.CADENZE[L.mesiCadenza(db)];
  const stati = keys.map((k) => L.statoSede(db, k)), rossi = stati.filter((s) => s.livello === 'rosso').length, gialli = stati.filter((s) => s.livello === 'giallo').length;
  const tit = [];
  if (rossi) tit.push(rossi === 1 ? '1 cassetta da sistemare' : `${rossi} cassette da sistemare`);
  else if (gialli) tit.push(gialli === 1 ? "1 cassetta da tenere d'occhio" : `${gialli} cassette da tenere d'occhio`);
  if (!fatto) tit.push(`controllo ${cad} da fare`);
  const livello = (rossi || !fatto) ? 'rosso' : gialli ? 'giallo' : 'verde';
  const an = L.anomalie(db), nR = an.filter((a) => a.tipo === 'reintegro').length, nS = an.length - nR;
  const det = [fatto ? `Prossimo controllo: ${L.dataLunga(prossimo)}` : `Previsto dal ${L.dataLunga(L.inizioPeriodo(db, now))}`];
  if (nR) det.push(nR === 1 ? '1 articolo da reintegrare' : `${nR} articoli da reintegrare`);
  if (nS) det.push(nS === 1 ? '1 scadenza da verificare' : `${nS} scadenze da verificare`);
  const giorni = Math.ceil((prossimo - now) / 86400000);
  const totR = stati.reduce((n, x) => n + x.richiesti, 0), totPct = totR ? stati.reduce((n, x) => n + x.presenti, 0) / totR * 100 : 100;
  const gruppi = keys.map((k) => ({ k, r: an.filter((a) => a.sede === k) })).filter((g) => g.r.length);
  const d = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `<div class="testa"><div class="logo">${ICO.croce}</div><div><div class="sopra">${esc(d.charAt(0).toUpperCase() + d.slice(1))}</div><h1>Pronto Soccorso</h1></div></div>
  <section class="eroe" style="--c:${COLORE[livello]}">
    <div class="eroe-riga">${anello(totPct, COLORE[livello], `${Math.round(totPct)}<small>%</small>`, true)}<div class="eroe-testo"><span class="eroe-stato">${livello === 'verde' ? 'TUTTO IN ORDINE' : livello === 'giallo' ? 'DA TENERE D\'OCCHIO' : 'SERVE INTERVENIRE'}</span><b>${esc(tit.join(' · ') || 'Tutto a posto')}</b><span>${esc(det.join(' · '))}</span></div></div>
    ${keys.length ? `<button class="btn" data-az="registra">${ICO.spunta}Registra controllo</button>` : ''}
  </section>
  <div class="due">${keys.map(schedaCassetta).join('')}
  <button class="carta controllo" data-az="calendario" style="--c:${fatto ? 'var(--verde)' : 'var(--rosso)'}"><span class="etichetta">${ICO.cal.replace('<svg', '<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"')}Controllo ${esc(cad)}</span>
    <strong>${fatto ? (giorni === 1 ? 'Tra 1 giorno' : `Tra ${giorni} giorni`) : 'Da fare'}</strong><small>${fatto ? 'Prossimo: ' + esc(L.dataLunga(prossimo)) : 'Previsto dal ' + esc(L.dataLunga(L.inizioPeriodo(db, now)))}</small>
    <span class="piede"><span>${fatto ? 'Registrato per questo periodo' : 'Successivo: ' + esc(L.dataLunga(prossimo))}</span><b>Calendario</b></span></button></div>
  <h2>Anomalie da risolvere · ${an.length}</h2>
  ${gruppi.length ? gruppi.map((g) => `<div class="lista"><div class="voce" style="min-height:40px"><small style="font-weight:700;letter-spacing:.06em">${esc(L.nomeSede(g.k).toUpperCase())} · ${g.r.length}</small></div>${g.r.map((a) => `<button class="voce" data-az="apri-sede" data-sede="${esc(a.sede)}"><span class="punto ${a.cls}" style="background:var(--c)"></span><span class="corpo"><b>${esc(a.articolo)}</b><small>${esc(a.dettaglio)}</small></span><span class="pill ${a.cls}">${a.etichetta}</span></button>`).join('')}</div>`).join('') : '<div class="carta vuota">Nessuna anomalia: dotazioni complete e scadenze regolari.</div>'}
  <div class="affianca"><button class="btn vuoto" data-az="modulo-vuoto">${ICO.foglio}Modulo vuoto</button><button class="btn secondario" data-az="modulo">${ICO.stampa}Modulo compilato</button></div>`;
}

/* ---------------- CASSETTE ---------------- */
function cassette() {
  if (ui.sede && db.sites[ui.sede]) return cassetta(ui.sede);
  const keys = Object.keys(db.sites);
  return `<div class="testa"><div><div class="sopra">${keys.length} ${keys.length === 1 ? 'cassetta' : 'cassette'}</div><h1>Cassette</h1></div></div>
  ${keys.map(schedaCassetta).join('') || '<div class="carta vuota">Nessuna cassetta. Aggiungila da Altro → Cassette.</div>'}`;
}
const grado = (x) => { const c = L.statoArticolo(db, x).cls; return c === 'c-grave' ? 0 : c === 'c-reintegro' ? 1 : c === 'c-scadenza' ? 2 : 3; };
function cassetta(s) {
  const st = L.statoSede(db, s), items = db.sites[s];
  // l'ordine (problemi in alto) si decide quando apri la cassetta e poi resta fermo:
  // cambiando quantità o scadenze le righe non si spostano sotto le dita
  if (ui.ordineDi !== s) { ui.ordineDi = s; ui.ordine = new Map(items.map((x) => [x.articolo, grado(x)])); }
  const ordine = items.map((x, i) => ({ x, i, g: ui.ordine.has(x.articolo) ? ui.ordine.get(x.articolo) : 4 })).sort((a, b) => a.g - b.g || a.x.articolo.localeCompare(b.x.articolo, 'it'));
  return `<button class="indietro" data-az="elenco">${ICO.indietro}Cassette</button>
  <div class="testa"><div><div class="sopra">Ultimo controllo: ${esc(L.ultimoControllo(db, s))}</div><h1>${esc(L.nomeSede(s))}</h1></div><span class="pill" style="--c:${COLORE[st.livello]};margin-bottom:6px">${ETICHETTA[st.livello]}</span></div>
  <div class="affianca"><button class="btn" data-az="controllo" data-sede="${esc(s)}">${ICO.spunta}Controllo</button><button class="btn secondario" data-az="uso" data-sede="${esc(s)}">${ICO.mano}Ho usato</button></div>
  <div class="tenue" style="padding:0 2px">Modifica qui quantità presenti e scadenze (MM/AA). Si salva da solo.</div>
  <div class="lista">${ordine.map(({ x, i }) => { const sa = L.statoArticolo(db, x); return `<div class="art">
    <button class="nome" data-az="modifica-art" data-sede="${esc(s)}" data-i="${i}"><b>${esc(x.articolo)}</b><small>Richiesti ${esc(x.richiesta)}</small></button><span class="pill ${sa.cls}">${sa.testo}</span>
    <div class="sotto"><div class="passi"><button data-az="passo" data-sede="${esc(s)}" data-i="${i}" data-d="-1" aria-label="Togli 1">−</button><input type="number" inputmode="numeric" min="0" value="${typeof x.disponibile === 'number' ? x.disponibile : 0}" data-campo="disponibile" data-sede="${esc(s)}" data-i="${i}" aria-label="Presenti"><button data-az="passo" data-sede="${esc(s)}" data-i="${i}" data-d="1" aria-label="Aggiungi 1">+</button></div>
    <input class="scad" value="${esc(x.scadenza === '/' ? '' : x.scadenza)}" placeholder="MM/AA" inputmode="numeric" data-campo="scadenza" data-sede="${esc(s)}" data-i="${i}" aria-label="Scadenza"><span class="etic">presenti · scadenza</span></div></div>`; }).join('') || '<div class="vuota">Nessun articolo.</div>'}</div>
  <button class="btn vuoto" data-az="nuovo-art" data-sede="${esc(s)}">${ICO.piu}Aggiungi articolo</button>`;
}

/* ---------------- REINTEGRO ---------------- */
function righeReintegro() {
  return L.anomalie(db).filter((a) => a.tipo !== 'scadenza' || true).map((a) => ({ cassetta: L.nomeSede(a.sede), sede: a.sede, articolo: a.articolo, motivo: a.tipo === 'reintegro' ? 'Da reintegrare' : a.etichetta === 'IN SCADENZA' ? 'In scadenza: sostituire' : a.etichetta === 'SCADUTO' ? 'Scaduto: sostituire' : 'Data errata: verificare', pezzi: a.pezzi, cls: a.cls }));
}
function reintegro() {
  const r = righeReintegro(), tot = r.reduce((n, x) => n + x.pezzi, 0), keys = Object.keys(db.sites);
  return `<div class="testa"><div><div class="sopra">${tot} pezzi da chiedere</div><h1>Reintegro</h1></div></div>
  ${r.length ? keys.map((k) => { const g = r.filter((x) => x.sede === k); return g.length ? `<h2>${esc(L.nomeSede(k))}</h2><div class="lista">${g.map((x) => `<button class="voce" data-az="apri-sede" data-sede="${esc(k)}"><span class="corpo"><b>${esc(x.articolo)}</b><small>${esc(x.motivo)}</small></span><span class="pill ${x.cls}" style="font-size:14px">${x.pezzi} pz</span></button>`).join('')}</div>` : ''; }).join('')
    + `<button class="btn" data-az="pdf-reintegro">${ICO.stampa}PDF da stampare o inviare</button>` : '<div class="carta vuota">Tutte le cassette sono complete e senza scadenze vicine.</div>'}`;
}

/* ---------------- STORICO ---------------- */
function storico() {
  const h = (db.history || []).map((x, i) => ({ x, i })).sort((a, b) => String(b.x.data).localeCompare(String(a.x.data)) || b.i - a.i);
  return `<div class="testa"><div><div class="sopra">${h.length} registrazioni</div><h1>Storico</h1></div></div>
  ${h.length ? `<div class="lista">${h.map(({ x, i }) => { const uso = x.tipo === 'uso', n = (x.esiti || []).length;
    return `<button class="voce" data-az="voce-storico" data-i="${i}"><span class="corpo"><b>${esc(L.dataIta(x.data))} · ${esc(L.nomeSede(x.sede || ''))}</b><small>${uso ? 'Usati: ' + esc((x.usati || []).map((u) => u.qta + ' × ' + u.articolo).join(', ') || '—') : esc((x.addetto || '—') + (x.ubicata ? ' · ' + x.ubicata : '') + (x.note ? ' · ' + x.note : ''))}</small></span><span class="pill ${uso ? 'c-uso' : n ? 'c-reintegro' : 'c-ok'}">${uso ? 'USO' : n ? n + ' DA VERIFICARE' : 'CONTROLLO'}</span></button>`; }).join('')}</div>` : '<div class="carta vuota">Nessun controllo registrato.</div>'}`;
}

/* ---------------- ALTRO ---------------- */
function altro() {
  const s = db.settings, keys = Object.keys(db.sites);
  return `<div class="testa"><div><div class="sopra">Impostazioni e copie</div><h1>Altro</h1></div></div>
  <h2>Calendario dei controlli</h2>
  <div class="carta">
    <div class="campo"><label for="fProssimo">Prossimo controllo</label><input id="fProssimo" type="date" value="${L.oggiIso(L.prossimoControllo(db))}"></div>
    <div class="campo"><label for="fCadenza">Ogni quanto</label><select id="fCadenza">${Object.entries(L.CADENZE).map(([n, t]) => `<option value="${n}"${Number(n) === L.mesiCadenza(db) ? ' selected' : ''}>${t[0].toUpperCase() + t.slice(1)} (ogni ${n} ${n === '1' ? 'mese' : 'mesi'})</option>`).join('')}</select></div>
    <div class="campo"><label for="fPreavviso">Preavviso</label><select id="fPreavviso">${[[0, 'Solo il giorno stesso'], [1, '1 giorno prima'], [2, '2 giorni prima'], [3, '3 giorni prima'], [5, '5 giorni prima'], [7, 'Una settimana prima']].map(([n, t]) => `<option value="${n}"${n === preavviso() ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
    <button class="btn" data-az="salva-cal">Salva date</button>
    <button class="btn secondario" data-az="calendario">${ICO.cal}Aggiungi al Calendario iPhone</button>
    <small class="tenue">Mette nel Calendario <b>un solo evento che si ripete</b> ogni ${L.mesiCadenza(db) === 1 ? 'mese' : L.mesiCadenza(db) + ' mesi'} dal ${esc(L.dataLunga(L.prossimoControllo(db)))}, con avviso alle 9 ${preavviso() ? `di ${preavviso() === 1 ? '1 giorno' : preavviso() + ' giorni'} prima e ` : ''}del giorno stesso.</small>
  </div>
  <div class="carta">
    <b>Hai cambiato data? Togli prima quelli vecchi</b>
    <small class="tenue">La app non può cancellare dal Calendario dell'iPhone: lo fai tu in un colpo solo. Nel <b>Calendario</b> apri un controllo cassette → <b>Elimina evento</b> → <b>Elimina tutti gli eventi futuri</b>. Poi qui tocca di nuovo <b>Aggiungi al Calendario iPhone</b>.</small>
  </div>
  <h2>Modulo Rev.04</h2>
  <div class="carta">
    <div class="voce" style="padding:0;min-height:0"><span class="corpo"><b>Modulo originale</b><small id="statoModulo">${ui.modulo ? esc(ui.modulo) : 'Non caricato'}</small></span><span class="pill ${ui.modulo ? 'c-ok' : 'c-reintegro'}">${ui.modulo ? 'PRONTO' : 'DA CARICARE'}</span></div>
    <button class="btn secondario" data-az="carica-modulo">${ICO.foglio}${ui.modulo ? 'Cambia modulo' : 'Carica il modulo dal cloud'}</button>
    <small class="tenue">Scegli il PDF (o la foto) del modulo da Drive, iCloud o File: resta solo in questo telefono, non va su internet.</small>
    <div class="campo"><label for="fIntest">Intestazione</label><input id="fIntest" value="${esc(typeof s.intestazione === 'string' ? s.intestazione : '')}"></div>
    <div class="campo"><label for="fSede">Sede</label><input id="fSede" value="${esc(typeof s.sedeModulo === 'string' ? s.sedeModulo : "Castelnovo ne' Monti")}"></div>
    <div class="campo"><label for="fAddetto">Addetto</label><input id="fAddetto" value="${esc(L.addettoPredefinito(db))}"></div>
    <button class="btn" data-az="salva-modulo">Salva</button>
  </div>
  <h2>Cassette</h2>
  <div class="lista">${keys.map((k) => `<button class="voce" data-az="gestisci-sede" data-sede="${esc(k)}"><span class="corpo"><b>${esc(L.nomeSede(k))}</b><small>${db.sites[k].length} articoli</small></span>${ICO.freccia}</button>`).join('')}
    <button class="voce" data-az="nuova-sede" style="color:var(--blu-t)"><span class="corpo"><b>+ Aggiungi cassetta</b></span></button></div>
  <h2>Copia dei dati</h2>
  <div class="carta">
    <small class="tenue">I dati stanno solo in questo telefono. Fai ogni tanto una copia e salvala in File o su Drive: serve se cambi telefono o cancelli i dati di Safari.</small>
    <button class="btn secondario" data-az="esporta">Salva una copia</button>
    <button class="btn vuoto" data-az="importa">Ripristina da una copia</button>
  </div>
  <button class="btn pericolo" data-az="azzera">Riparti dall'elenco standard</button>
  <div class="tenue" style="text-align:center;padding:6px 0 0">Gestione Pronto Soccorso · versione ${VERSIONE} · Andrea Canovi</div>`;
}

/* ---------------- FOGLI ---------------- */
function apriFoglio(html) { $('foglio').innerHTML = '<div class="maniglia"></div>' + html; $('foglio').hidden = false; $('velo').hidden = false; $('foglio').scrollTop = 0; }
function chiudiFoglio() { $('foglio').hidden = true; $('velo').hidden = true; $('foglio').innerHTML = ''; }
const testaFoglio = (t, sopra = '') => `<div class="testa-foglio"><div>${sopra ? `<div class="tenue">${esc(sopra)}</div>` : ''}<h3>${esc(t)}</h3></div><button class="chiudi" data-az="chiudi" aria-label="Chiudi">×</button></div>`;

function foglioControllo(s) {
  const items = db.sites[s];
  apriFoglio(testaFoglio('Controllo ' + L.nomeSede(s), 'Modulo Rev.04') + `
    <div class="affianca"><div class="campo"><label for="cData">Data</label><input id="cData" type="date" value="${L.oggiIso()}"></div><div class="campo"><label for="cAddetto">Addetto</label><input id="cAddetto" value="${esc(L.addettoPredefinito(db))}"></div></div>
    <div class="campo"><label for="cUbicata">Ubicata presso</label><input id="cUbicata" placeholder="Es. ufficio, reparto…" value="${esc(ultimaUbicata(s))}"></div>
    <button class="btn verde" data-az="tutto-a-posto">${ICO.spunta}Tutto a posto</button>
    <div class="lista">${items.map((x, i) => `<div class="art"><div class="nome"><b>${esc(x.articolo)}</b><small>Richiesti ${esc(x.richiesta)}</small></div><label class="integro"><input type="checkbox" id="ci${i}" checked>integro</label>
      <div class="sotto"><div class="passi"><button data-az="passo-c" data-i="${i}" data-d="-1">−</button><input type="number" inputmode="numeric" min="0" id="cq${i}" value="${typeof x.disponibile === 'number' ? x.disponibile : 0}"><button data-az="passo-c" data-i="${i}" data-d="1">+</button></div><input class="scad" id="ce${i}" value="${esc(x.scadenza === '/' ? '' : x.scadenza)}" placeholder="MM/AA" inputmode="numeric"><span class="etic">presenti · scadenza</span></div></div>`).join('')}</div>
    <div class="campo"><label for="cNote">Note</label><textarea id="cNote"></textarea></div>
    <button class="btn" data-az="salva-controllo" data-sede="${esc(s)}">Salva controllo</button>`);
}
function ultimaUbicata(s) { const h = L.controlli(db).filter((x) => x.sede === s && x.ubicata).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0]; return h ? h.ubicata : ''; }
function salvaControllo(s) {
  const data = $('cData').value; if (!data) { avviso('Inserisci la data del controllo.'); return; }
  const esiti = [];
  db.sites[s].forEach((x, i) => {
    x.disponibile = Math.max(0, Math.floor(Number($('cq' + i).value) || 0));
    x.scadenza = $('ce' + i).value.trim() || '/';
    const m = L.manca(x), e = L.esitoScadenza(db, x.scadenza), integro = $('ci' + i).checked;
    if (!integro) esiti.push(x.articolo + ': non integro');
    else if (e === 'Scaduto' || e === 'Data anomala') esiti.push(x.articolo + ': ' + (e === 'Scaduto' ? 'scaduto' : 'data errata'));
    else if (m) esiti.push(x.articolo + ': integrare ' + m);
    else if (e === 'In scadenza') esiti.push(x.articolo + ': in scadenza');
  });
  db.history.push({ data, sede: s, cassetta: L.nomeSede(s), ubicata: $('cUbicata').value.trim(), addetto: $('cAddetto').value.trim(), n: db.sites[s].length, note: $('cNote').value.trim(), esiti });
  salva(); chiudiFoglio(); disegna();
  apriFoglio(testaFoglio('Controllo salvato') + `<div class="tenue">${esiti.length ? esiti.length + ' cose da sistemare: le trovi in Reintegro.' : 'Cassetta a posto.'}</div>
    <button class="btn" data-az="modulo">${ICO.stampa}Crea il modulo compilato</button><button class="btn vuoto" data-az="chiudi">Non ora</button>`);
}
function foglioUso(s) {
  const items = db.sites[s];
  apriFoglio(testaFoglio('Ho usato la cassetta', L.nomeSede(s)) + `<div class="tenue">Segna cosa hai preso: i pezzi vengono tolti e finiscono subito in Reintegro.</div>
    <div class="affianca"><div class="campo"><label for="uData">Data</label><input id="uData" type="date" value="${L.oggiIso()}"></div><div class="campo"><label for="uChi">Chi l'ha usata</label><input id="uChi" value="${esc(L.addettoPredefinito(db))}"></div></div>
    <div class="lista">${items.map((x, i) => `<div class="art"><div class="nome"><b>${esc(x.articolo)}</b><small>Presenti ${typeof x.disponibile === 'number' ? x.disponibile : 0}</small></div><span></span><div class="sotto"><div class="passi"><button data-az="passo-u" data-i="${i}" data-d="-1">−</button><input type="number" inputmode="numeric" min="0" id="uq${i}" value="0"><button data-az="passo-u" data-i="${i}" data-d="1">+</button></div><span class="etic">usati</span></div></div>`).join('')}</div>
    <div class="campo"><label for="uNote">Motivo / note</label><input id="uNote" placeholder="Es. taglio a una mano in officina"></div>
    <button class="btn" data-az="salva-uso" data-sede="${esc(s)}">Registra uso</button>`);
}
function salvaUso(s) {
  const data = $('uData').value; if (!data) { avviso('Inserisci la data.'); return; }
  const usati = [];
  db.sites[s].forEach((x, i) => { const q = Math.max(0, Math.floor(Number($('uq' + i).value) || 0)); const p = typeof x.disponibile === 'number' ? x.disponibile : 0; const t = Math.min(q, p); if (t) { x.disponibile = p - t; usati.push({ articolo: x.articolo, qta: t }); } });
  if (!usati.length) { avviso('Segna almeno un pezzo usato.'); return; }
  db.history.push({ tipo: 'uso', data, sede: s, cassetta: L.nomeSede(s), addetto: $('uChi').value.trim(), note: $('uNote').value.trim(), usati });
  salva(); chiudiFoglio(); disegna(); { const n = usati.reduce((t, u) => t + u.qta, 0); avviso(`Uso registrato: ${n} ${n === 1 ? "pezzo tolto" : "pezzi tolti"}.`); };
}
function foglioArticolo(s, i) {
  const x = i >= 0 ? db.sites[s][i] : { articolo: '', richiesta: 1, disponibile: 0, scadenza: '/' };
  apriFoglio(testaFoglio(i >= 0 ? 'Modifica articolo' : 'Nuovo articolo', L.nomeSede(s)) + `
    <div class="campo"><label for="aNome">Descrizione</label><input id="aNome" value="${esc(x.articolo)}"></div>
    <div class="affianca"><div class="campo"><label for="aRich">Quantità richiesta</label><input id="aRich" type="number" inputmode="numeric" min="0" value="${esc(x.richiesta)}"></div><div class="campo"><label for="aPres">Presenti</label><input id="aPres" type="number" inputmode="numeric" min="0" value="${typeof x.disponibile === 'number' ? x.disponibile : 0}"></div></div>
    <div class="campo"><label for="aScad">Scadenza (MM/AA, vuoto se non scade)</label><input id="aScad" value="${esc(x.scadenza === '/' ? '' : x.scadenza)}" inputmode="numeric"></div>
    <button class="btn" data-az="salva-art" data-sede="${esc(s)}" data-i="${i}">Salva</button>
    ${i >= 0 ? `<button class="btn pericolo" data-az="elimina-art" data-sede="${esc(s)}" data-i="${i}">Elimina articolo</button>` : ''}`);
}
function foglioSede(k) {
  apriFoglio(testaFoglio(k ? 'Cassetta ' + L.nomeSede(k) : 'Nuova cassetta') + `
    <div class="campo"><label for="sNome">Nome</label><input id="sNome" value="${esc(k ? L.nomeSede(k) : '')}" placeholder="Es. Magazzino"><small>${k ? '' : 'Parte con gli articoli dell\'elenco standard: poi li sistemi.'}</small></div>
    <button class="btn" data-az="salva-sede" data-sede="${esc(k)}">Salva</button>
    ${k ? `<button class="btn pericolo" data-az="elimina-sede" data-sede="${esc(k)}">Elimina cassetta</button>` : ''}`);
}
function foglioStorico(i) {
  const h = db.history[i]; if (!h) return;
  const uso = h.tipo === 'uso';
  apriFoglio(testaFoglio(uso ? 'Uso della cassetta' : 'Controllo', L.nomeSede(h.sede || '')) + `
    <div class="campo"><label for="hData">Data</label><input id="hData" type="date" value="${esc(h.data)}"></div>
    <div class="campo"><label for="hAdd">${uso ? "Chi l'ha usata" : 'Addetto'}</label><input id="hAdd" value="${esc(h.addetto || '')}"></div>
    ${uso ? '' : `<div class="campo"><label for="hUb">Ubicata presso</label><input id="hUb" value="${esc(h.ubicata || '')}"></div>`}
    <div class="campo"><label for="hNote">Note</label><textarea id="hNote">${esc(h.note || '')}</textarea></div>
    ${(h.esiti || []).length ? `<div class="carta"><b>Da verificare</b><small class="tenue">${esc(h.esiti.join(' · '))}</small></div>` : ''}
    ${uso && (h.usati || []).length ? `<div class="carta"><b>Usati</b><small class="tenue">${esc(h.usati.map((u) => u.qta + ' × ' + u.articolo).join(' · '))}</small></div>` : ''}
    <small class="tenue">Le quantità delle cassette non cambiano modificando o eliminando questa voce.</small>
    <button class="btn" data-az="salva-storico" data-i="${i}">Salva</button>
    <button class="btn pericolo" data-az="elimina-storico" data-i="${i}">Elimina</button>`);
}

/* ---------------- FILE: PDF, calendario, copie ---------------- */
async function consegna(byte, nome, tipo) {
  const file = new File([byte], nome, { type: tipo });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nome }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file), a = document.createElement('a');
  a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const stamp = () => L.oggiIso().replaceAll('-', '');
async function modulo(vuoto) {
  try {
    avviso('Preparo il modulo…');
    const b = await pdfModulo(vuoto ? null : L.datiModulo(db, L.cassetteDelPeriodo(db)));
    await consegna(b, (vuoto ? 'Modulo_vuoto_' : 'Modulo_controllo_') + stamp() + '.pdf', 'application/pdf');
  } catch (e) { avviso('Modulo non creato: ' + e.message); if (!ui.modulo) setTimeout(() => vai('altro'), 1200); }
}
async function calendario() {
  const ics = calendarioIcs(L.prossimoControllo(db), L.mesiCadenza(db), L.CADENZE[L.mesiCadenza(db)], preavviso());
  const blob = new Blob([ics], { type: 'text/calendar' });
  // sull'iPhone aprire il file .ics mostra "Aggiungi tutti" al Calendario
  const url = URL.createObjectURL(blob);
  location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* ---------------- DISEGNO E AZIONI ---------------- */
const preavviso = () => { const n = Number(db.settings.preavviso); return [0, 1, 2, 3, 5, 7].includes(n) ? n : 2; };
function aggiornaBollino() { const n = L.anomalie(db).filter((a) => a.tipo === 'reintegro').length; const b = $('bollino'); b.textContent = n; b.hidden = !n; }
function disegna() {
  const pag = { oggi, cassette, reintegro, storico, altro }[ui.scheda] || oggi;
  $('schermo').innerHTML = pag();
  document.querySelectorAll('#schede button').forEach((b) => b.setAttribute('aria-current', b.dataset.scheda === ui.scheda ? 'page' : 'false'));
  aggiornaBollino();
}
function vai(scheda, sede = '') { ui.scheda = scheda; ui.sede = sede; ui.ordineDi = ''; disegna(); window.scrollTo(0, 0); }
function chiave(nome, escludi) {
  const k = String(nome).trim().replace(/\s+/g, ' ').toUpperCase();
  if (!k) return { errore: 'Scrivi il nome della cassetta.' };
  if (k.length > 24) return { errore: 'Nome troppo lungo: massimo 24 caratteri.' };
  if (k !== escludi && db.sites[k]) return { errore: 'Esiste già una cassetta con questo nome.' };
  return { k };
}
const conferme = new Set();
function conferma(el, testo) { const id = el.dataset.az + (el.dataset.i || '') + (el.dataset.sede || ''); if (conferme.has(id)) { conferme.delete(id); return true; } conferme.add(id); el.textContent = testo; setTimeout(() => conferme.delete(id), 4000); return false; }

const AZ = {
  'apri-sede': (el) => vai('cassette', el.dataset.sede),
  elenco: () => vai('cassette'),
  registra: () => { const inizio = L.inizioPeriodo(db), keys = Object.keys(db.sites); const s = keys.find((k) => !L.fattaNelPeriodo(db, k, inizio)) || keys[0]; if (s) { vai('cassette', s); foglioControllo(s); } },
  controllo: (el) => foglioControllo(el.dataset.sede),
  uso: (el) => foglioUso(el.dataset.sede),
  chiudi: chiudiFoglio,
  passo: (el) => { const x = db.sites[el.dataset.sede][+el.dataset.i]; x.disponibile = Math.max(0, (typeof x.disponibile === 'number' ? x.disponibile : 0) + Number(el.dataset.d)); salva(); disegnaMantieni(); },
  'passo-c': (el) => { const q = $('cq' + el.dataset.i); q.value = Math.max(0, (Number(q.value) || 0) + Number(el.dataset.d)); },
  'passo-u': (el) => { const q = $('uq' + el.dataset.i); q.value = Math.max(0, (Number(q.value) || 0) + Number(el.dataset.d)); },
  'tutto-a-posto': () => { const s = document.querySelector('[data-az="salva-controllo"]').dataset.sede; db.sites[s].forEach((x, i) => { const q = $('cq' + i); q.value = Math.max(Number(q.value) || 0, Number(x.richiesta) || 0); $('ci' + i).checked = true; }); avviso('Tutte le quantità al richiesto. Controlla le scadenze.'); },
  'salva-controllo': (el) => salvaControllo(el.dataset.sede),
  'salva-uso': (el) => salvaUso(el.dataset.sede),
  'modifica-art': (el) => foglioArticolo(el.dataset.sede, +el.dataset.i),
  'nuovo-art': (el) => foglioArticolo(el.dataset.sede, -1),
  'salva-art': (el) => {
    const s = el.dataset.sede, i = +el.dataset.i, nome = $('aNome').value.trim(); if (!nome) { avviso('Scrivi la descrizione.'); return; }
    if (db.sites[s].some((x, j) => j !== i && x.articolo.toUpperCase() === nome.toUpperCase())) { avviso('Articolo già presente in questa cassetta.'); return; }
    const x = { articolo: nome, richiesta: Math.max(0, Math.floor(Number($('aRich').value) || 0)), disponibile: Math.max(0, Math.floor(Number($('aPres').value) || 0)), scadenza: $('aScad').value.trim() || '/' };
    if (i >= 0) db.sites[s][i] = x; else db.sites[s].push(x);
    salva(); chiudiFoglio(); disegna();
  },
  'elimina-art': (el) => { if (!conferma(el, 'Tocca di nuovo per eliminare')) return; db.sites[el.dataset.sede].splice(+el.dataset.i, 1); salva(); chiudiFoglio(); disegna(); },
  'voce-storico': (el) => foglioStorico(+el.dataset.i),
  'salva-storico': (el) => { const h = db.history[+el.dataset.i]; h.data = $('hData').value || h.data; h.addetto = $('hAdd').value.trim(); if ($('hUb')) h.ubicata = $('hUb').value.trim(); h.note = $('hNote').value.trim(); salva(); chiudiFoglio(); disegna(); },
  'elimina-storico': (el) => { if (!conferma(el, 'Tocca di nuovo per eliminare')) return; db.history.splice(+el.dataset.i, 1); salva(); chiudiFoglio(); disegna(); },
  modulo: () => modulo(false),
  'modulo-vuoto': () => modulo(true),
  'pdf-reintegro': async () => { try { const r = righeReintegro(); const b = await pdfReintegro(r, `Stampato il ${new Date().toLocaleDateString('it-IT')} · ${r.length} righe`); await consegna(b, 'Pezzi_da_chiedere_' + stamp() + '.pdf', 'application/pdf'); } catch (e) { avviso('PDF non creato: ' + e.message); } },
  calendario: () => calendario(),
  'salva-cal': () => { const v = $('fProssimo').value; if (!v) { avviso('Scegli la data del prossimo controllo.'); return; } db.settings.dataRiferimento = v; db.settings.cadenza = Number($('fCadenza').value); db.settings.preavviso = Number($('fPreavviso').value); salva(); disegna(); avviso('Salvato. Togli i vecchi dal Calendario e aggiungi di nuovo.'); },
  'salva-modulo': () => { db.settings.intestazione = $('fIntest').value.trim(); db.settings.sedeModulo = $('fSede').value.trim(); db.settings.addetto = $('fAddetto').value.trim(); salva(); avviso('Salvato.'); },
  'gestisci-sede': (el) => foglioSede(el.dataset.sede),
  'nuova-sede': () => { if (Object.keys(db.sites).length >= 10) { avviso('Massimo 10 cassette.'); return; } foglioSede(''); },
  'salva-sede': (el) => {
    const vecchia = el.dataset.sede, r = chiave($('sNome').value, vecchia); if (r.errore) { avviso(r.errore); return; }
    if (!vecchia) { db.sites[r.k] = L.datiIniziali().sites.NEGOZIO.map((x) => ({ ...x, disponibile: 0, scadenza: '/' })); }
    else if (r.k !== vecchia) { const nuovi = {}; for (const [k, v] of Object.entries(db.sites)) nuovi[k === vecchia ? r.k : k] = v; db.sites = nuovi; db.history.forEach((h) => { if (h.sede === vecchia) { h.sede = r.k; h.cassetta = L.nomeSede(r.k); } }); }
    salva(); chiudiFoglio(); disegna();
  },
  'elimina-sede': (el) => { if (Object.keys(db.sites).length <= 1) { avviso('Deve restare almeno una cassetta.'); return; } if (!conferma(el, 'Tocca di nuovo: elimini cassetta e articoli')) return; delete db.sites[el.dataset.sede]; salva(); chiudiFoglio(); disegna(); },
  esporta: () => consegna(JSON.stringify(db, null, 1), 'ProntoSoccorso_copia_' + stamp() + '.json', 'application/json'),
  importa: () => $('scegliFile').click(),
  'carica-modulo': () => $('scegliModulo').click(),
  azzera: (el) => { if (!conferma(el, 'Tocca di nuovo: cancelli tutto e riparti')) return; db = L.datiIniziali(); salva(); vai('oggi'); avviso('Ripartito dall\'elenco standard.'); },
};
function disegnaMantieni() { const y = window.scrollY; disegna(); window.scrollTo(0, y); }

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-scheda]'); if (t) { vai(t.dataset.scheda); return; }
  const el = e.target.closest('[data-az]'); if (el && AZ[el.dataset.az]) { e.preventDefault(); AZ[el.dataset.az](el); }
});
$('velo').addEventListener('click', chiudiFoglio);
document.addEventListener('change', (e) => {
  const el = e.target; if (!el.dataset || !el.dataset.campo) return;
  const x = db.sites[el.dataset.sede][+el.dataset.i];
  if (el.dataset.campo === 'disponibile') x.disponibile = Math.max(0, Math.floor(Number(el.value) || 0));
  else x.scadenza = el.value.trim() || '/';
  salva(); disegnaMantieni();
});
$('scegliFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { db = L.normalizza(JSON.parse(await f.text())); salva(); vai('oggi'); avviso('Dati ripristinati.'); } catch (err) { avviso('File non valido: ' + err.message); }
});

$('scegliModulo').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { await salvaModulo(await provaModulo(f)); await aggiornaModulo(); disegna(); avviso('Modulo caricato: lo trovi nei PDF.'); } catch (err) { avviso('Modulo non caricato: ' + err.message); }
});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
aggiornaModulo().then(disegna);
disegna();
{ const v = $('sp-ver'); if (v) v.textContent = `versione ${VERSIONE}`; }
(function chiudiSplash() {
  const sp = $('splash'); if (!sp) return;
  const resta = Math.max(0, 2300 - performance.now());     // la barra arriva in fondo, poi si apre la app
  setTimeout(() => { sp.classList.add('via'); document.body.classList.add('intro'); setTimeout(() => { sp.remove(); document.body.classList.remove('intro'); }, 1400); }, resta);
})();
