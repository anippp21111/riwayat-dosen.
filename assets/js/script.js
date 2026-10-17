(function () {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const home = $('#home-view');
  const detail = $('#detail-view');
  const cacheKey = 'pnl-education-cache-v1';

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }
  function showMessage(element, text, isError = false) {
    element.innerHTML = text ? `<div class="note${isError ? ' error' : ''}">${escapeHtml(text)}</div>` : '';
  }
  async function api(url) {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Permintaan gagal (HTTP ${response.status}).`);
    return payload;
  }
  function readCache() {
    try { return JSON.parse(localStorage.getItem(cacheKey) || '{}'); } catch { return {}; }
  }
  function saveCache(cache) {
    try { localStorage.setItem(cacheKey, JSON.stringify(cache)); } catch { /* Cache browser penuh; ekspor tetap berjalan. */ }
  }
  function normalize(value) { return String(value || '').toLocaleLowerCase('id').replace(/[^\p{L}\p{N}]+/gu, ''); }
  function first(record, keys) {
    for (const key of keys) {
      const value = record?.[key];
      if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value).trim();
    }
    return '';
  }
  function education(record) {
    return {
      jenjang: first(record, ['jenjang', 'nama_jenjang_didik', 'jenjang_pendidikan', 'nama_jenjang']),
      gelar: first(record, ['gelar', 'singkatan_gelar', 'nama_gelar']),
      bidang: first(record, ['bidang', 'bidang_studi', 'nama_prodi', 'program_studi', 'prodi']),
      pt: first(record, ['nama_pt', 'perguruan_tinggi', 'nama_perguruan_tinggi']),
      tahun: first(record, ['tahun_lulus', 'tahun', 'tgl_lulus']),
    };
  }
  function pairs(record) {
    return Object.entries(record || {}).filter(([, value]) => ['string', 'number'].includes(typeof value) && String(value).trim())
      .map(([key, value]) => [key.replaceAll('_', ' '), String(value).trim()]);
  }
  function renderEducation(records) {
    const content = $('#education-content');
    if (!records.length) { content.innerHTML = '<p class="empty">Belum ada data riwayat pendidikan.</p>'; return; }
    records.sort((a, b) => Number(education(b).tahun.replace(/\D/g, '')) - Number(education(a).tahun.replace(/\D/g, '')));
    content.innerHTML = `<ol class="timeline">${records.map((record) => {
      const item = education(record);
      if (!Object.values(item).some(Boolean)) return `<li><dl class="kv">${pairs(record).map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl></li>`;
      return `<li>${item.tahun ? `<div class="year">${escapeHtml(item.tahun)}</div>` : ''}<div class="jenjang">${escapeHtml(item.jenjang || 'Pendidikan')}${item.gelar ? `<small> · ${escapeHtml(item.gelar)}</small>` : ''}</div>${item.pt ? `<div class="pt">${escapeHtml(item.pt)}</div>` : ''}${item.bidang ? `<div class="bidang">${escapeHtml(item.bidang)}</div>` : ''}</li>`;
    }).join('')}</ol>`;
  }
  function flatten(record) {
    const result = {};
    for (const [key, value] of Object.entries(record || {})) {
      if (['string', 'number', 'boolean'].includes(typeof value)) result[key] = String(value);
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [child, childValue] of Object.entries(value)) if (['string', 'number'].includes(typeof childValue)) result[`${key}_${child}`] = String(childValue);
      }
    }
    return result;
  }
  function renderTeaching(records) {
    const content = $('#teaching-content');
    if (!records.length) { content.innerHTML = '<p class="empty">Belum ada data riwayat mengajar.</p>'; return; }
    const rows = records.map(flatten);
    const semesterKey = Object.keys(rows[0] || {}).find((key) => /semester|(^|_)smt($|_)/i.test(key));
    const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))].filter((key) => key !== semesterKey && !/^id($|_)/i.test(key));
    const groups = new Map();
    for (const row of rows) {
      const semester = (semesterKey && row[semesterKey]) || 'Semester tidak diketahui';
      if (!groups.has(semester)) groups.set(semester, []);
      groups.get(semester).push(row);
    }
    content.innerHTML = [...groups].map(([semester, group]) => `<div class="semester"><h3>${escapeHtml(semester)} <span class="badge">${group.length}</span></h3><div class="scroll"><table class="mk"><thead><tr>${columns.map((key) => `<th>${escapeHtml(key.replaceAll('_', ' '))}</th>`).join('')}</tr></thead><tbody>${group.map((row) => `<tr>${columns.map((key) => `<td>${escapeHtml(row[key] || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`).join('');
  }

  async function openDetail(lecturer) {
    if (!lecturer.id) {
      showMessage($('#home-message'), 'Profil ditemukan pada daftar PNL, tetapi ID riwayat PDDikti untuk dosen ini belum tersedia. Coba cari menggunakan NIDN.', true);
      return;
    }
    const url = new URL(location.href);
    url.search = `?id=${encodeURIComponent(lecturer.id)}`;
    history.pushState({ lecturer }, '', url);
    renderDetail(lecturer);
  }
  async function renderDetail(lecturer) {
    home.hidden = true;
    detail.hidden = false;
    document.body.className = 'is-detail';
    document.title = `Riwayat Dosen PNL · ${lecturer.nama}`;
    $('#lecturer-name').textContent = lecturer.nama;
    $('#lecturer-facts').innerHTML = [lecturer.nama_prodi, lecturer.nidn ? `NIDN ${lecturer.nidn}` : '', lecturer.nuptk ? `NUPTK ${lecturer.nuptk}` : ''].filter(Boolean).map((fact) => `<span>${escapeHtml(fact)}</span>`).join('');
    $('#education-content').innerHTML = '<p class="empty">Memuat data…</p>';
    $('#teaching-content').innerHTML = '<p class="empty">Memuat data…</p>';
    for (const type of ['pendidikan', 'mengajar']) {
      const target = type === 'pendidikan' ? $('#education-content') : $('#teaching-content');
      try {
        const payload = await api(`/api/detail?type=${type}&id=${encodeURIComponent(lecturer.id)}`);
        type === 'pendidikan' ? renderEducation(payload.data || []) : renderTeaching(payload.data || []);
      } catch (error) { showMessage(target, error.message, true); }
    }
  }

  $('#search-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = $('#search-input');
    const button = $('#search-button');
    const query = input.value.trim();
    if (query.length < 3) return;
    button.disabled = true;
    button.textContent = 'Mencari…';
    $('#results').innerHTML = '';
    showMessage($('#home-message'), 'Menghubungi PDDikti…');
    document.body.className = 'is-results';
    try {
      let result;
      try { result = await api(`/api/search?q=${encodeURIComponent(query)}`); }
      catch (searchError) {
        const roster = await api('/api/roster');
        const needle = normalize(query);
        result = { data: (roster.data || []).filter((person) => normalize(person.nama).includes(needle) || normalize(person.nidn).includes(needle) || normalize(person.nuptk).includes(needle))
          .map((person) => ({ id: '', nama: person.nama, nidn: person.nidn, nuptk: person.nuptk, nama_prodi: person.prodi, sumber: 'daftar PNL' })) };
        if (!result.data.length) throw searchError;
      }
      const lecturers = result.data || [];
      showMessage($('#home-message'), '');
      if (!lecturers.length) {
        showMessage($('#home-message'), `Tidak ditemukan dosen PNL dengan nama “${query}”.`);
      } else {
        if (lecturers.some((lecturer) => !lecturer.id)) showMessage($('#home-message'), 'Hasil berasal dari daftar resmi dosen PNL. Riwayat pendidikan terperinci tersedia jika dosen ditemukan juga di PDDikti.');
        $('#results').innerHTML = `<div class="count">${lecturers.length} dosen ditemukan</div><ul class="list">${lecturers.map((lecturer, index) => `<li><a href="?id=${encodeURIComponent(lecturer.id)}" data-index="${index}"><span><div class="nama">${escapeHtml(lecturer.nama)}</div><div class="info">${escapeHtml([lecturer.nama_prodi, lecturer.nidn ? `NIDN ${lecturer.nidn}` : ''].filter(Boolean).join(' · '))}</div></span><span class="arrow">→</span></a></li>`).join('')}</ul>`;
        $('#results').querySelectorAll('a[data-index]').forEach((link) => link.addEventListener('click', (click) => { click.preventDefault(); openDetail(lecturers[Number(link.dataset.index)]); }));
        const url = new URL(location.href); url.search = `?q=${encodeURIComponent(query)}`; history.pushState({ query }, '', url);
      }
    } catch (error) { showMessage($('#home-message'), error.message, true); }
    finally { button.disabled = false; button.textContent = 'Cari'; }
  });

  function educationLevel(label) {
    const value = String(label || '').toLocaleUpperCase('id');
    if (/(^|[^0-9])S\s*1([^0-9]|$)|SARJANA|DIPLOMA\s*IV|D\s*4/u.test(value)) return 'S1';
    if (/(^|[^0-9])S\s*2([^0-9]|$)|MAGISTER|MASTER/u.test(value)) return 'S2';
    if (/(^|[^0-9])S\s*3([^0-9]|$)|DOKTOR|DOCTOR/u.test(value)) return 'S3';
    return '';
  }
  function csvCell(value) {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }
  async function pooled(items, limit, worker) {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        await worker(items[index], index);
      }
    }));
  }
  $('#export-button').addEventListener('click', async () => {
    const button = $('#export-button');
    button.disabled = true;
    try {
      const rosterPayload = await api('/api/roster');
      const unique = new Map();
      for (const lecturer of rosterPayload.data || []) {
        const key = lecturer.nidn || lecturer.nuptk || normalize(lecturer.nama);
        if (!unique.has(key)) unique.set(key, { ...lecturer });
        else {
          const old = unique.get(key);
          old.prodi = [...new Set([...(old.prodi || '').split(' | '), lecturer.prodi].filter(Boolean))].join(' | ');
          old.jurusan = [...new Set([...(old.jurusan || '').split(' | '), lecturer.jurusan].filter(Boolean))].join(' | ');
        }
      }
      const lecturers = [...unique.values()];
      const cache = readCache();
      let completed = 0;
      await pooled(lecturers, 6, async (lecturer) => {
        const key = lecturer.nidn || normalize(lecturer.nama);
        const prior = cache[key];
        const retryFailed = prior?.failed && Date.now() - Number(prior.failedAt || 0) > 10 * 60 * 1000;
        if (!prior || retryFailed) {
          try {
            const query = lecturer.nidn || lecturer.nama;
            const result = await api(`/api/search?fast=1&q=${encodeURIComponent(query)}`);
            const match = (result.data || []).find((item) => (lecturer.nidn && item.nidn === lecturer.nidn) || normalize(item.nama) === normalize(lecturer.nama));
            if (!match) cache[key] = { data: [], status: 'Tidak ditemukan di PDDikti.' };
            else {
              const history = await api(`/api/detail?type=pendidikan&id=${encodeURIComponent(match.id)}`);
              cache[key] = { data: history.data || [], status: 'Riwayat tersedia.' };
            }
            saveCache(cache);
          } catch (error) {
            cache[key] = { data: [], status: error.message, failed: true, failedAt: Date.now() };
            saveCache(cache);
          }
        }
        completed += 1;
        button.textContent = `Mengunduh ${completed}/${lecturers.length}…`;
      });

      const headers = ['No', 'Nama Dosen', 'NIDN', 'NUPTK', 'S1 - Kampus', 'S1 - Tahun Lulus', 'S2 - Kampus', 'S2 - Tahun Lulus', 'S3 - Kampus', 'S3 - Tahun Lulus', 'Program Studi', 'Jurusan', 'Status Aktif', 'Status Riwayat PDDikti'];
      const rows = [headers];
      for (const lecturer of lecturers) {
        const key = lecturer.nidn || normalize(lecturer.nama);
        const history = cache[key] || { data: [], status: 'Riwayat tidak tersedia.' };
        const levels = { S1: { campus: new Set(), year: new Set() }, S2: { campus: new Set(), year: new Set() }, S3: { campus: new Set(), year: new Set() } };
        for (const record of history.data || []) {
          const level = educationLevel(first(record, ['jenjang', 'nama_jenjang_didik', 'jenjang_pendidikan', 'nama_jenjang']));
          if (!level) continue;
          const campus = first(record, ['nama_pt', 'perguruan_tinggi', 'nama_perguruan_tinggi']);
          const year = first(record, ['tahun_lulus', 'tahun', 'tgl_lulus']);
          if (campus) levels[level].campus.add(campus);
          if (year) levels[level].year.add(year);
        }
        const join = (set) => [...set].join(' | ');
        const row = [lecturer.no, lecturer.nama, lecturer.nidn, lecturer.nuptk,
          join(levels.S1.campus), join(levels.S1.year), join(levels.S2.campus), join(levels.S2.year), join(levels.S3.campus), join(levels.S3.year),
          lecturer.prodi, lecturer.jurusan, lecturer.status,
          history.data?.length ? 'Riwayat tersedia' : history.status];
        rows.push(row);
      }
      const excelCell = (value) => {
        let text = String(value ?? '');
        if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
        return `<td>${escapeHtml(text)}</td>`;
      };
      const table = `<html><head><meta charset="utf-8"></head><body><table>${rows.map((row) => `<tr>${row.map(excelCell).join('')}</tr>`).join('')}</table></body></html>`;
      const blob = new Blob([`\uFEFF${table}`], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `rekap-pendidikan-dosen-pnl-${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(href);
      showMessage($('#home-message'), `File berisi ${lecturers.length} dosen. Riwayat pendidikan yang gagal ditemukan diberi status di kolom terakhir.`);
    } catch (error) { showMessage($('#home-message'), error.message, true); }
    finally { button.disabled = false; button.textContent = 'Unduh Excel'; }
  });

  $('#back-link').addEventListener('click', (event) => { event.preventDefault(); history.back(); });
  window.addEventListener('popstate', async (event) => {
    if (event.state?.lecturer) await renderDetail(event.state.lecturer);
    else {
      detail.hidden = true; home.hidden = false; document.body.className = '';
      document.title = 'Riwayat Dosen PNL';
    }
  });
  document.addEventListener('keydown', (event) => {
    const tag = (document.activeElement || {}).tagName;
    if (event.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { event.preventDefault(); $('#search-input').focus(); }
  });

  const initial = new URLSearchParams(location.search);
  if (initial.get('q')) { $('#search-input').value = initial.get('q'); $('#search-form').requestSubmit(); }
})();
