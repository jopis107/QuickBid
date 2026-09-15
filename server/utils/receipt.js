// Uvoz biblioteke za programsko generiranje PDF dokumenata
const PDFDocument = require('pdfkit');

/**
 * Generira PDF potvrdu o pobjedi i podatke za uplatu te ga šalje izravno u HTTP odgovor
 * @param {import('http').ServerResponse} res - Express odgovor
 * @param {object} data - Podaci o aukciji, pobjedniku, cijeni i valuti
 */
function streamReceipt(res, data) {
  const { item, winner, amount, currency } = data;
  
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  // Postavljanje HTTP zaglavlja tako da preglednik odmah prepozna i ponudi preuzimanje PDF datoteke
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="racun_${item.id}.pdf"`);
  // Preusmjeravanje PDF toka izravno u mrežni odgovor
  doc.pipe(res);

  // Zaglavlje dokumenta s QuickBid logotipom
  doc
    .fontSize(22)
    .fillColor('#0f172a')
    .text('QuickBid', { align: 'left' })
    .fontSize(10)
    .fillColor('#334155')
    .text('Potvrda pobjede na aukciji i podaci za uplatu')
    .moveDown(1.5);

  // Plava razdjelna linija
  doc
    .strokeColor('#3b82f6')
    .lineWidth(2)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke()
    .moveDown(1);

  // Podaci o aukcijskom predmetu
  doc.fontSize(14).fillColor('#0f172a').text('Podaci o predmetu', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1e293b');
  doc.text(`Naziv predmeta: ${item.title}`);
  doc.text(`Opis: ${item.description}`);
  doc.text(`ID aukcije: ${item.id}`);
  doc.moveDown(1);

  // Podaci o pobjedniku aukcije
  doc.fontSize(14).fillColor('#0f172a').text('Podaci o pobjedniku', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1e293b');
  doc.text(`Korisnicko ime: ${winner.username}`);
  doc.text(`Email: ${winner.email}`);
  doc.moveDown(1);

  // Podaci za bankovnu uplatu i poziv na broj
  doc.fontSize(14).fillColor('#0f172a').text('Podaci za uplatu', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(11).fillColor('#1e293b');
  doc.text(`Iznos za uplatu: ${amount.toFixed(2)} ${currency}`);
  doc.text('Primatelj: QuickBid d.o.o.');
  doc.text('IBAN: HR00 0000 0000 0000 0000 0');
  doc.text('Model i poziv na broj: HR00 ' + item.id + '-' + winner.id);
  doc.text('Opis placanja: Uplata za pobjedu na aukciji #' + item.id);
  doc.moveDown(1.5);

  // Napomena na dnu dokumenta
  doc
    .fontSize(9)
    .fillColor('#64748b')
    .text(
      'Ovo je automatski generirana potvrda. Uplatu izvršite u roku od 7 dana od primitka ove potvrde.',
      { align: 'left' }
    );

  // Zatvaranje toka i finalizacija PDF-a
  doc.end();
}

module.exports = { streamReceipt };