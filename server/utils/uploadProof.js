// Uvoz Multera za obradu potvrda o uplatama
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Provjera i kreiranje uploads mape
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Pohrana uplatnica na disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.pdf'].includes(ext) ? ext : '.pdf';
    cb(null, `proof_${Date.now()}_${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

// Dozvoljeni formati: slike ili PDF dokumenti uplatnica
function fileFilter(req, file, cb) {
  const isImage = /^image\/(png|jpe?g|webp)$/.test(file.mimetype);
  const isPdf = file.mimetype === 'application/pdf';
  if (isImage || isPdf) {
    cb(null, true);
  } else {
    cb(new Error('Potvrda o uplati mora biti slika (png/jpg/webp) ili PDF.'));
  }
}

// Inicijalizacija Multera s limitom od 5MB
const uploadProof = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = uploadProof;