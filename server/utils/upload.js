// Uvoz Multer paketa za obradu multipart/form-data (upload slika)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Definiranje i provjera postojanja 'uploads' direktorija
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfiguracija diskovne pohrane - spremanje na lokalni disk servera
const storage = multer.diskStorage({
  // Određivanje mape u koju se datoteka sprema
  destination: (req, file, cb) => cb(null, uploadDir),
  
  // Generiranje jedinstvenog i sigurnog imena za svaku sliku
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
    cb(null, `item_${Date.now()}_${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});

// Sigurnosni filter - odbijanje svega što nije valjana slika
function fileFilter(req, file, cb) {
  if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Dopuštene su samo slike (png, jpg, webp, gif).'));
  }
}

// Inicijalizacija Multer instance s ograničenjem veličine od 5MB
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

module.exports = upload;