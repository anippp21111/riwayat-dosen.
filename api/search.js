const { request, fallbackRequest, recordsFrom, pick, isPnl, normalize } = require('../lib/pddikti');

async function pnlRoster(query) {
  const response = await fetch('https://data.pnl.ac.id/dosen/list', {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Portal PNL gagal diakses (HTTP ${response.status}).`);
  const html = await response.text();
  const decode = (value) => value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const needle = normalize(query);
  const data = [];
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => decode(match[1]));
    if (cells.length < 11 || !/^\d+$/.test(cells[0])) continue;
    if (!normalize(cells[1]).includes(needle) && !normalize(cells[2]).includes(needle) && !normalize(cells[3]).includes(needle)) continue;
    data.push({ id: '', nama: cells[1], nidn: cells[2], nuptk: cells[3], nama_prodi: cells[8], sumber: 'daftar PNL' });
  }
  return data;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  const keyword = String(req.query.q || '').trim();
  if (keyword.length < 3 || keyword.length > 120) return res.status(400).json({ error: 'Masukkan nama dosen minimal 3 karakter.' });

  let lastError;
  const pddiktiRecords = [];
  try {
    const records = recordsFrom(await fallbackRequest(`/search/dosen/${encodeURIComponent(keyword)}/`));
    pddiktiRecords.push(...records);
    const data = records.filter(isPnl).map((record) => ({
      id: pick(record, ['id', 'id_dosen', 'id_sdm', 'id_person']),
      nama: pick(record, ['nama', 'nama_dosen']),
      nidn: pick(record, ['nidn']),
      nuptk: pick(record, ['nuptk']),
      nama_prodi: pick(record, ['nama_prodi', 'prodi']),
    })).filter((record) => record.id && record.nama);
    if (data.length) return res.status(200).json({ data, source: 'pddikti-proxy' });
  } catch (error) { lastError = error; }

  const paths = req.query.fast === '1'
    ? [`/pencarian/dosen/${encodeURIComponent(keyword)}`]
    : [`/pencarian/dosen/${encodeURIComponent(keyword)}`, `/pencarian/en/call/${encodeURIComponent(keyword)}`];
  for (const path of paths) {
    try {
      const records = recordsFrom(await request(path));
      pddiktiRecords.push(...records);
      const data = records.filter(isPnl).map((record) => ({
        id: pick(record, ['id', 'id_dosen', 'id_sdm', 'id_person']),
        nama: pick(record, ['nama', 'nama_dosen']),
        nidn: pick(record, ['nidn']),
        nuptk: pick(record, ['nuptk']),
        nama_prodi: pick(record, ['nama_prodi', 'prodi']),
      })).filter((record) => record.id && record.nama);
      if (data.length) return res.status(200).json({ data });
    } catch (error) { lastError = error; }
  }
  try {
    const roster = await pnlRoster(keyword);
    const normalizeNidn = (value) => String(value || '').replace(/\D/g, '').replace(/^0+/, '');
    const rosterByNidn = new Map(roster.filter((item) => item.nidn).map((item) => [normalizeNidn(item.nidn), item]));
    const exactNames = new Map();
    for (const item of roster) {
      const name = normalize(item.nama);
      exactNames.set(name, [...(exactNames.get(name) || []), item]);
    }
    const matched = pddiktiRecords.map((record) => {
      const nidn = pick(record, ['nidn']);
      const nama = pick(record, ['nama', 'nama_dosen']);
      const verified = (nidn && rosterByNidn.get(normalizeNidn(nidn))) || (exactNames.get(normalize(nama)) || []).length === 1 && exactNames.get(normalize(nama))[0];
      if (!verified) return null;
      return {
        id: pick(record, ['id', 'id_dosen', 'id_sdm', 'id_person']),
        nama: verified.nama || nama,
        nidn: verified.nidn || nidn,
        nuptk: verified.nuptk || pick(record, ['nuptk']),
        nama_prodi: verified.nama_prodi || pick(record, ['nama_prodi', 'prodi']),
      };
    }).filter((item) => item?.id && item.nama);
    const data = matched.length ? matched : roster;
    return res.status(200).json({ data, source: 'roster' });
  } catch (error) {
    return res.status(lastError ? 502 : 200).json({ error: error.message || lastError?.message || 'Pencarian dosen gagal.', data: [] });
  }
};
