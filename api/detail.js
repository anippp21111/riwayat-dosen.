const { request, fallbackRequest, recordsFrom, pick, normalize } = require('../lib/pddikti');
const { educationFor } = require('../lib/education');

function lecturerId(record) {
  return pick(record, ['id', 'id_dosen', 'id_sdm', 'id_person', 'id_pegawai', 'idDosen', 'idSdm']);
}

function matchingId(records, nidn, nama) {
  const targetNidn = String(nidn || '').replace(/\D/g, '');
  const targetName = normalize(nama || '');
  const matchingNidn = targetNidn && records.filter((record) => {
    const candidate = pick(record, ['nidn', 'NIDN']).replace(/\D/g, '');
    return candidate && (candidate === targetNidn || candidate.replace(/^0+/, '') === targetNidn.replace(/^0+/, ''));
  });
  if (matchingNidn?.length === 1) return lecturerId(matchingNidn[0]);
  const matchingName = targetName && records.filter((record) => normalize(pick(record, ['nama', 'nama_dosen', 'nama_sdm'])) === targetName);
  if (matchingName?.length === 1) return lecturerId(matchingName[0]);
  // Some PDDikti search responses omit NIDN/name after a numeric query. Accept a
  // single identified result only when the lookup keyword itself is a NIDN.
  if (targetNidn && records.length === 1) return lecturerId(records[0]);
  return '';
}

async function resolveLecturerId(nidn, nama) {
  const keywords = [...new Set([nidn, nama].map((value) => String(value || '').trim()).filter(Boolean))];
  let lastError;
  for (const keyword of keywords) {
    try {
      const records = recordsFrom(await fallbackRequest(`/search/dosen/${encodeURIComponent(keyword)}/`));
      const id = matchingId(records, nidn, nama);
      if (id) return { id, error: null };
    } catch (error) { lastError = error; /* Coba endpoint PDDikti berikutnya. */ }
    try {
      const records = recordsFrom(await request(`/pencarian/dosen/${encodeURIComponent(keyword)}`));
      const id = matchingId(records, nidn, nama);
      if (id) return { id, error: null };
    } catch (error) { lastError = error; /* Tampilkan pesan layanan jika semua pencarian gagal. */ }
  }
  return { id: '', error: lastError };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  let id = String(req.query.id || '').trim();
  const nidn = String(req.query.nidn || '').trim();
  const nama = String(req.query.nama || '').trim();
  const type = String(req.query.type || 'pendidikan');
  const paths = { pendidikan: '/dosen/study-history', mengajar: '/dosen/teaching-history' };
  if ((!id && !nidn && !nama) || id.length > 200 || !paths[type]) return res.status(400).json({ error: 'Permintaan detail tidak valid.' });
  if (type === 'pendidikan') {
    try {
      const records = educationFor({ nidn, nama });
      if (records.length) return res.status(200).json({ data: records, source: 'rekap-pnl' });
    } catch (error) {
      // A missing or incompatible file must not prevent the PDDikti lookup below.
      if (!id) return res.status(200).json({ data: [], source: 'rekap-pnl', warning: error.message });
    }
  }
  if (!id && type === 'mengajar' && (nidn || nama)) {
    const resolved = await resolveLecturerId(nidn, nama);
    id = resolved.id;
    if (!id && resolved.error) return res.status(502).json({ error: `Gagal mencari ID dosen di PDDikti: ${resolved.error.message}` });
  }
  if (!id) return res.status(200).json({
    data: [], source: 'pddikti',
    warning: type === 'mengajar'
      ? 'PDDikti belum memberikan ID dosen untuk NIDN/nama ini, sehingga riwayat mengajar belum dapat diminta.'
      : 'Riwayat pendidikan belum ada di file rekap dan ID dosen PDDikti belum tersedia.',
  });
  try {
    const payload = await request(paths[type], { method: 'POST', body: { id } });
    const data = recordsFrom(payload);
    if (data.length) return res.status(200).json({ data, source: 'pddikti' });
  } catch { /* Lanjutkan ke penyedia cadangan jika API utama dibatasi. */ }
  try {
    const route = type === 'pendidikan' ? 'study-history' : 'teaching-history';
    const payload = await fallbackRequest(`/dosen/${route}/${encodeURIComponent(id)}/`);
    const data = recordsFrom(payload);
    return res.status(200).json({ data, source: 'pddikti-proxy', ...(data.length ? {} : { warning: 'API PDDikti tidak menemukan riwayat untuk dosen ini.' }) });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Detail dosen gagal dimuat.' });
  }
};
