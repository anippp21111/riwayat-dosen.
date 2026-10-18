const API_ROOT = 'https://pddikti.kemdiktisaintek.go.id/api';
const FALLBACK_API_ROOTS = [
  'https://pddikti.rone.dev/api',
  'https://pddikti.fastapicloud.dev/api',
];
const PNL_MATCH = 'politekniknegerilhokseumawe';

function normalize(value = '') {
  return String(value).toLocaleLowerCase('id').replace(/[^\p{L}\p{N}]+/gu, '');
}

function recordsFrom(value, depth = 0) {
  if (depth > 6 || !value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.filter((item) => item && typeof item === 'object');
  const fields = new Set(Object.keys(value).map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const has = (...names) => names.some((name) => fields.has(name));
  const lecturerRecord = has('nidn', 'iddosen', 'idsdm', 'idperson', 'idpegawai')
    || (has('id') && has('namadosen'))
    || (has('nama', 'namadosen') && has('namapt', 'namaprodi'));
  const historyRecord = has('jenjang', 'namajenjangdidik', 'namajenjang', 'semester', 'thsmt', 'kodekelas', 'kodemk', 'namamk', 'namamatakuliah');
  if (lecturerRecord || historyRecord) return [value];
  for (const key of ['dosen', 'data', 'results', 'result', 'items', 'records', 'content']) {
    if (Object.hasOwn(value, key)) {
      const records = recordsFrom(value[key], depth + 1);
      if (records.length) return records;
    }
  }
  return [];
}

function pick(record, keys) {
  for (const key of keys) {
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const actualKey = Object.keys(record || {}).find((candidate) => candidate.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey);
    const value = actualKey ? record[actualKey] : undefined;
    if (typeof value === 'string' || typeof value === 'number') {
      if (String(value).trim()) return String(value).trim();
    }
  }
  return '';
}

function institution(record) {
  for (const key of ['nama_pt', 'nama_perguruan_tinggi', 'perguruan_tinggi', 'pt', 'nama_institusi']) {
    const value = record?.[key];
    const name = typeof value === 'object' && value ? (value.nama_pt || value.nama || value.name || '') : value;
    const normalized = normalize(name || '');
    if (normalized) return normalized;
  }
  return '';
}

function isPnl(record) {
  const name = institution(record);
  return name.includes(PNL_MATCH) || name === 'pnl';
}

async function request(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Origin: 'https://pddikti.kemdiktisaintek.go.id',
      Referer: 'https://pddikti.kemdiktisaintek.go.id/',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`Respons PDDikti tidak valid (HTTP ${response.status}).`); }
  if (!response.ok) throw new Error(data?.message || `PDDikti gagal (HTTP ${response.status}).`);
  return data;
}

async function fallbackRequest(path) {
  let lastError;
  for (const root of FALLBACK_API_ROOTS) {
    try {
      const response = await fetch(`${root}${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { throw new Error(`Respons layanan PDDikti cadangan tidak valid (HTTP ${response.status}).`); }
      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || data?.detail || `Layanan PDDikti cadangan gagal (HTTP ${response.status || data?.status?.http_code || 'tidak diketahui'}).`);
      }
      return data;
    } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Semua gateway PDDikti cadangan sedang tidak tersedia.');
}

module.exports = { API_ROOT, normalize, recordsFrom, pick, isPnl, request, fallbackRequest };
