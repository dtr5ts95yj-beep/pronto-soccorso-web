// PDF nel telefono (pdf-lib): elenco dei pezzi da chiedere.
// E il file .ics per mettere le date dei controlli nel Calendario dell'iPhone.

const pulisci = (t) => String(t ?? '').replace(/[→←]/g, '-').replace(/[^\x20-\x7E -ÿ€’‘“”–—]/g, '');
const L = 595.28, H = 841.89;

async function base(titolo) {
  const { PDFDocument, StandardFonts } = window.PDFLib;
  const doc = await PDFDocument.create();
  doc.setTitle(titolo); doc.setAuthor('Gestione Pronto Soccorso');
  return { doc, reg: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
}
/* Archivio interno del telefono: serve solo a togliere il modulo salvato dalle versioni precedenti. */
function archivio() {
  return new Promise((ok, ko) => { const r = indexedDB.open('pronto-soccorso', 1); r.onupgradeneeded = () => r.result.createObjectStore('file'); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });
}
export async function salvaModulo(v) {
  const db = await archivio();
  return new Promise((ok, ko) => { const tx = db.transaction('file', 'readwrite'); v ? tx.objectStore('file').put(v, 'modulo') : tx.objectStore('file').delete('modulo'); tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); });
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
