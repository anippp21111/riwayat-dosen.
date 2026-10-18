const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const FILE_PREFIX = 'rekap-pendidikan-dosen-pnl';
let cachedFile;
let cachedModified = 0;
let cachedRecords = [];

function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('id').replace(/[^a-z0-9]+/g, '');
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function readSheet(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const rows = [];
  for (const [, rowHtml] of text.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => decodeHtml(match[1]));
    if (cells.length) rows.push(cells);
  }
  if (rows.length) return rows;

  // Accept a UTF-8 CSV renamed to .xls as well as the HTML Excel file produced by the app.
  if (!text.includes('\0') && /[,;\t]/.test(text.slice(0, 500))) {
    return text.split(/\r?\n/).filter(Boolean).map((line) => line.split(/\t|;|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"')));
  }
  throw new Error('File rekap harus berupa Excel hasil unduhan aplikasi (format HTML .xls) atau CSV UTF-8.');
}

function column(headers, names) {
  const normalized = headers.map(normalize);
  for (const name of names) {
    const index = normalized.indexOf(normalize(name));
    if (index >= 0) return index;
  }
  return -1;
}

function readRecords() {
  const file = fs.readdirSync(ROOT).find((name) => name.toLocaleLowerCase('id').startsWith(FILE_PREFIX) && name.toLocaleLowerCase('id').endsWith('.xls'));
  if (!file) return [];
  const filePath = path.join(ROOT, file);
  const modified = fs.statSync(filePath).mtimeMs;
  if (cachedFile === filePath && cachedModified === modified) return cachedRecords;
  const rows = readSheet(filePath);
  const headers = rows[0] || [];
  const nameColumn = column(headers, ['Nama Dosen', 'Nama']);
  const nidnColumn = column(headers, ['NIDN']);
  if (nidnColumn < 0) throw new Error('Kolom NIDN tidak ditemukan pada file rekap pendidikan.');

  const levels = ['S1', 'S2', 'S3'].map((level) => ({
    level,
    campus: column(headers, [`${level} - Kampus`, `${level} Kampus`, `Kampus ${level}`]),
    year: column(headers, [`${level} - Tahun Lulus`, `${level} Tahun Lulus`, `Tahun Lulus ${level}`]),
  }));
  const records = [];
  for (const cells of rows.slice(1)) {
    const nidn = String(cells[nidnColumn] || '').replace(/\D/g, '');
    if (!nidn) continue;
    const pendidikan = [];
    for (const level of levels) {
      const campus = level.campus >= 0 ? String(cells[level.campus] || '').trim() : '';
      const year = level.year >= 0 ? String(cells[level.year] || '').trim() : '';
      if (campus || year) pendidikan.push({ jenjang: level.level, nama_pt: campus, tahun_lulus: year });
    }
    records.push({
      nidn,
      nama: nameColumn >= 0 ? String(cells[nameColumn] || '').trim() : '',
      pendidikan,
    });
  }
  cachedFile = filePath;
  cachedModified = modified;
  cachedRecords = records;
  return cachedRecords;
}

function educationFor({ nidn = '', nama = '' } = {}) {
  const targetNidn = String(nidn).replace(/\D/g, '');
  const targetName = normalize(nama);
  if (!targetNidn && !targetName) return [];
  return readRecords().filter((record) => (targetNidn && record.nidn === targetNidn)
    || (!targetNidn && targetName && normalize(record.nama) === targetName))
    .flatMap((record) => record.pendidikan);
}

module.exports = { educationFor };
