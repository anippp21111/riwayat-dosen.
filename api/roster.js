function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  try {
    const response = await fetch('https://data.pnl.ac.id/dosen/list', {
      headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Portal PNL gagal diakses (HTTP ${response.status}).`);
    const html = await response.text();
    const rows = [];
    for (const [, rowHtml] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => decodeHtml(match[1]));
      if (cells.length < 11 || !/^\d+$/.test(cells[0])) continue;
      rows.push({
        no: cells[0], nama: cells[1], nidn: cells[2], nuptk: cells[3], pendidikanTerakhir: cells[4],
        status: cells[5], statusPegawai: cells[6], ikatanKerja: cells[7], prodi: cells[8], jurusan: cells[9], semester: cells[10],
      });
    }
    if (!rows.length) throw new Error('Data daftar dosen portal PNL kosong atau formatnya berubah.');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ data: rows });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Daftar dosen PNL gagal dimuat.' });
  }
};
