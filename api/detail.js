const { request, recordsFrom } = require('../lib/pddikti');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  const id = String(req.query.id || '').trim();
  const type = String(req.query.type || 'pendidikan');
  const paths = { pendidikan: '/dosen/study-history', mengajar: '/dosen/teaching-history' };
  if (!id || id.length > 200 || !paths[type]) return res.status(400).json({ error: 'Permintaan detail tidak valid.' });
  try {
    const payload = await request(paths[type], { method: 'POST', body: { id } });
    return res.status(200).json({ data: recordsFrom(payload) });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Detail dosen gagal dimuat.' });
  }
};
