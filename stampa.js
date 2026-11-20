// PDF nel telefono (pdf-lib): modulo Rev.04 sul modulo originale, modulo vuoto, elenco da reintegrare.
// E il file .ics per mettere le date dei controlli nel Calendario dell'iPhone.
import { RIGHE_MODULO } from './dati-iniziali.js';

const pulisci = (t) => String(t ?? '').replace(/[→←]/g, '-').replace(/[^\x20-\x7E -ÿ€’‘“”–—]/g, '');
const L = 595.28, H = 841.89;
// misure del modulo cartaceo (punti PDF, origine in basso a sinistra), come nel programma per Windows
const GRUPPI = [[239.0, 262.8, 315.3, 346.6], [346.6, 370.7, 423.6, 459.8], [459.8, 483.8, 538.3, 568.3]];
const BORDI = [497.0, 474.5, 460.6, 434.6, 411.4, 388.6, 364.8, 345.8, 323.6, 300.5, 282.5, 259.2, 247.7, 234.2, 220.3, 204.5, 181.9, 165.8, 143.5, 126.2, 109.2];
const indiceStd = (nome) => RIGHE_MODULO.findIndex((r) => r[0] === String(nome || '').trim().toUpperCase());

async function base(titolo) {
  const { PDFDocument, StandardFonts } = window.PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle(titolo); doc.setAuthor('Gestione Pronto Soccorso');
  return { doc, reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
}
/* Il modulo originale non sta su GitHub: lo scegli tu una volta (Drive, iCloud, File) e resta solo nel telefono. */
function archivio() {
  return new Promise((ok, ko) => { const r = indexedDB.open('pronto-soccorso', 1); r.onupgradeneeded = () => r.result.createObjectStore('file'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
}
export async function leggiModulo() {
  const db = await archivio();
  return new Promise((ok, ko) => { const t = db.transaction('file').objectStore('file').get('modulo'); t.onsuccess = () => ok(t.result || null); t.onerror = () => ko(t.error); });
}
export async function salvaModulo(v) {
  const db = await archivio();
  return new Promise((ok, ko) => { const tx = db.transaction('file', 'readwrite'); v ? tx.objectStore('file').put(v, 'modulo') : tx.objectStore('file').delete('modulo'); tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); });
}
/** Controlla che il file scelto sia un PDF o un'immagine usabile come sfondo. */
export async function provaModulo(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = bytes[0] === 0x25 && bytes[1] === 0x50, png = bytes[0] === 0x89 && bytes[1] === 0x50, jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!pdf && !png && !jpg) throw new Error('scegli un PDF, PNG o JPG');
  const { PDFDocument } = window.PDFLib, doc = await PDFDocument.create();
  if (pdf) await doc.embedPdf(bytes, [0]); else if (png) await doc.embedPng(bytes); else await doc.embedJpg(bytes);
  return { nome: file.name, tipo: pdf ? 'pdf' : png ? 'png' : 'jpg', bytes, data: new Date().toISOString() };
}
async function disegnaSfondo(doc) {
  const m = await leggiModulo();
  if (!m) throw new Error('prima carica il modulo originale in Altro → Modulo Rev.04');
  if (m.tipo === 'pdf') { const [pg] = await doc.embedPdf(m.bytes, [0]); return (p) => p.drawPage(pg, { x: 0, y: 0, width: L, height: H }); }
  const img = m.tipo === 'png' ? await doc.embedPng(m.bytes) : await doc.embedJpg(m.bytes);
  return (p) => p.drawImage(img, { x: 0, y: 0, width: L, height: H });
}

/** Modulo Rev.04 compilato (o vuoto, se dati è null). 3 cassette per foglio. */
export async function pdfModulo(dati) {
  const { rgb } = window.PDFLib;
  const { doc, reg, bold } = await base('Modulo controllo presidi sanitari / cassetta primo soccorso');
  const sfondo = await disegnaSfondo(doc), nero = rgb(0, 0, 0);
  if (!dati) { sfondo(doc.addPage([L, H])); return doc.save(); }

  const scrivi = (p, x, y, testo, f = reg, size = 9) => { testo = pulisci(testo); if (testo) p.drawText(testo, { x, y, size, font: f, color: nero }); };
  const riempi = (p, x, y, valore, w, f = bold, size = 10) => {
    let t = pulisci(valore); if (!t) return;
    while (size > 6 && f.widthOfTextAtSize(t, size) > w) size -= 0.25;
    while (t.length > 1 && f.widthOfTextAtSize(t, size) > w) t = t.slice(0, -1);
    p.drawText(t, { x, y, size, font: f, color: nero });
  };
  const centro = (p, cx, y, testo, size) => { const t = pulisci(testo); p.drawText(t, { x: cx - bold.widthOfTextAtSize(t, size) / 2, y, size, font: bold, color: nero }); };
  const spunta = (p, cx, cy, s) => p.drawSvgPath(`M ${-s} 0 L ${-s * 0.3} ${s * 0.8} L ${s * 1.1} ${-s * 0.9}`, { x: cx, y: cy, borderColor: nero, borderWidth: 1.3 });
  const aCapo = (t, size, w) => { const parole = pulisci(t).split(/\s+/), righe = []; let r = ''; for (const p of parole) { const n = r ? r + ' ' + p : p; if (reg.widthOfTextAtSize(n, size) > w && r) { righe.push(r); r = p; } else r = n; } if (r) righe.push(r); return righe; };

  const standard = dati.righe.filter((r) => indiceStd(r.articolo) >= 0);
  const extra = dati.righe.filter((r) => indiceStd(r.articolo) < 0);
  const blocchi = []; for (let i = 0; i < dati.cassette.length; i += 3) blocchi.push(dati.cassette.slice(i, i + 3));
  const totale = blocchi.length + (extra.length ? 1 : 0);
  blocchi.forEach((blocco, ci) => {
    const p = doc.addPage([L, H]);
    sfondo(p);
    riempi(p, 252, 737.5, dati.sede, 130, bold, 11);
    [715.4, 700.6, 685.7].forEach((y, i) => { if (i < blocco.length) riempi(p, 97, y + 2, blocco[i].nome + (blocco[i].ubicata ? ` (${blocco[i].ubicata})` : ''), 160, bold, 10); });
    GRUPPI.forEach(([g0, , b], gi) => { if (gi < blocco.length) riempi(p, g0 + 12, 567.4, String(blocco[gi].nome).toUpperCase(), b - g0 - 15, bold, 7.5); });
    for (const r of standard) {
      const k = indiceStd(r.articolo), top = BORDI[k], bottom = BORDI[k + 1], mid = (top + bottom) / 2;
      GRUPPI.forEach(([g0, a, b, g1], gi) => {
        const c = r.celle[ci * 3 + gi]; if (!c || gi >= blocco.length) return;
        if (c.adeguato) spunta(p, (g0 + a) / 2, mid + 0.4, Math.min(4.2, (top - bottom) / 3.3));
        if (c.integrare !== undefined && c.integrare !== '' && Number(c.integrare) !== 0) { const size = Math.min(10.5, (top - bottom) * 0.85); centro(p, (a + b) / 2, mid - size * 0.35, String(c.integrare), size); }
        if (c.scadenza) centro(p, (b + g1) / 2, mid - 3, c.scadenza, c.scadenza.length <= 5 ? 8.6 : 7.4);
      });
    }
    aCapo(dati.note, 8.6, 500).slice(0, 2).forEach((riga, j) => scrivi(p, 62, 91 - j * 9.5, riga, reg, 8.6));
    riempi(p, 104, 72.5, dati.data, 64, bold, 10.5);
    riempi(p, 193, 49.5, dati.addetto, 145, bold, 10.5);
    if (totale > 1) scrivi(p, 518, 30, `Pagina ${ci + 1} di ${totale}`, reg, 7.5);
  });
  if (extra.length) {   // articoli che non sono sul modulo stampato: foglio a parte con lo stesso schema
    const p = doc.addPage([L, H]); let y = H - 60;
    scrivi(p, 40, y, 'ARTICOLI AGGIUNTIVI (non presenti sul modulo Rev.04)', bold, 13); y -= 16;
    scrivi(p, 40, y, `Sede: ${dati.sede} · Data controllo: ${dati.data || '-'} · Addetto: ${dati.addetto || '-'}`, reg, 9); y -= 26;
    const col = [['Articolo', 40], ...dati.cassette.map((c, i) => [c.nome, 250 + i * 105])];
    col.forEach(([t, x]) => scrivi(p, x, y, t, bold, 9.5)); y -= 6;
    p.drawLine({ start: { x: 40, y }, end: { x: L - 40, y }, thickness: 0.6 }); y -= 15;
    for (const r of extra) {
      if (y < 60) break;
      riempi(p, 40, y, r.articolo, 200, reg, 9.5);
      r.celle.forEach((c, i) => { if (i >= dati.cassette.length || !c) return; const t = c.adeguato ? 'Adeguato' : `Integrare ${c.integrare}` + (c.scadenza ? ` · scad. ${c.scadenza}` : ''); riempi(p, 250 + i * 105, y, t, 100, bold, 9); });
      y -= 6; p.drawLine({ start: { x: 40, y }, end: { x: L - 40, y }, thickness: 0.3 }); y -= 15;
    }
    scrivi(p, 518, 30, `Pagina ${totale} di ${totale}`, reg, 7.5);
  }
  return doc.save();
}

/** Elenco dei pezzi da chiedere (reintegro e prodotti da sostituire), in bianco e nero. */
export async function pdfReintegro(righe, info) {
  const { rgb } = window.PDFLib;
  const { doc, reg, bold } = await base('Pezzi da chiedere - pronto soccorso');
  const nero = rgb(0, 0, 0), grigio = rgb(0.35, 0.35, 0.35), chiaro = rgb(0.86, 0.86, 0.86), M = 36;
  const col = [['CASSETTA', M, 90], ['ARTICOLO', M + 90, 210], ['MOTIVO', M + 300, 150], ['DA CHIEDERE', M + 450, 73]];
  const tronca = (t, f, s, w) => { t = pulisci(t); while (t && f.widthOfTextAtSize(t, s) > w - 8) t = t.slice(0, -1); return t; };
  let p, y;
  const pagina = (prima) => {
    p = doc.addPage([L, H]); y = H - M;
    if (prima) { p.drawText('PEZZI DA CHIEDERE - CASSETTE PRONTO SOCCORSO', { x: M, y: y - 16, size: 15, font: bold, color: nero }); y -= 30; p.drawText(pulisci(info), { x: M, y: y - 8, size: 9.5, font: reg, color: grigio }); y -= 22; }
    p.drawRectangle({ x: M, y: y - 20, width: L - 2 * M, height: 20, color: chiaro });
    col.forEach(([t, x]) => p.drawText(t, { x: x + 4, y: y - 14, size: 8.5, font: bold, color: nero }));
    y -= 20;
  };
  pagina(true);
  for (const r of righe) {
    if (y < M + 30) pagina(false);
    const vals = [r.cassetta, r.articolo, r.motivo, String(r.pezzi)];
    col.forEach(([, x, w], i) => p.drawText(tronca(vals[i], i === 3 ? bold : reg, i === 3 ? 12 : 9.5, w), { x: x + 4, y: y - 17, size: i === 3 ? 12 : 9.5, font: i === 3 ? bold : reg, color: nero }));
    y -= 26; p.drawLine({ start: { x: M, y }, end: { x: L - M, y }, thickness: 0.4, color: grigio });
  }
  const tot = righe.reduce((n, r) => n + (Number(r.pezzi) || 0), 0);
  if (y < M + 30) pagina(false);
  p.drawText(`TOTALE PEZZI DA CHIEDERE: ${tot}`, { x: M, y: y - 22, size: 11, font: bold, color: nero });
  return doc.save();
}

/** File .ics: UN solo evento che si ripete (ogni N mesi), così nel Calendario si toglie tutto in un colpo
 *  con "Elimina tutti gli eventi futuri". Avviso alle 9 del giorno, e alle 9 di N giorni prima. */
export function calendarioIcs(primo, mesi, cadenza, preavviso) {
  const f = (d) => d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const ora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const fine = new Date(primo); fine.setDate(fine.getDate() + 1);
  const prima = preavviso > 0 ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:Tra ${preavviso} ${preavviso === 1 ? 'giorno' : 'giorni'}: controllo cassette pronto soccorso`, `TRIGGER:-PT${preavviso * 24 - 9}H`, 'END:VALARM'] : [];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Gestione Pronto Soccorso//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:controlli-cassette-${f(primo)}@pronto-soccorso`, `DTSTAMP:${ora}`, `DTSTART;VALUE=DATE:${f(primo)}`, `DTEND;VALUE=DATE:${f(fine)}`,
    `RRULE:FREQ=MONTHLY;INTERVAL=${mesi};COUNT=${Math.max(4, Math.round(36 / mesi))}`,
    `SUMMARY:Controllo ${cadenza} cassette pronto soccorso`, 'DESCRIPTION:Controlla le cassette e registra il controllo nella app Pronto Soccorso.',
    ...prima,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Oggi: controllo cassette pronto soccorso', 'TRIGGER:PT9H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
}
