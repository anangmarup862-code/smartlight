// static/app.js
'use strict';

/*
  App JS for LightPlan
  - Normalizes lamps & rooms data from /static/lamps.json and /static/rooms.json
  - Provides category -> room -> sub-room -> lamp flows
  - Calculation (mode1/mode2) + visualizer + export PNG
*/

/* ---------- Globals ---------- */
let lamps = [];
let rooms = [];

let selectedCategory = '';
let selectedRoom = '';
let selectedSubRoom = '';
let selectedLampIndex = null;

/* ---------- Helpers ---------- */
function toKey(s) {
  if (!s) return '';
  return String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '').replace(/^_+|_+$/g, '');
}

function parseLux(value) {
  // Accept "120-150" or "250" or numeric
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const str = String(value);
  const m = str.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

/* ---------- Load & Normalize Data ---------- */
async function loadData() {
  try {
    const [lampRes, roomRes] = await Promise.all([
      fetch('/static/lamps.json', { cache: 'no-cache' }),
      fetch('/static/rooms.json', { cache: 'no-cache' })
    ]);

    if (!lampRes.ok) throw new Error(`Failed to fetch lamps.json: ${lampRes.status}`);
    if (!roomRes.ok) throw new Error(`Failed to fetch rooms.json: ${roomRes.status}`);

    const rawLamps = await lampRes.json();
    const rawRooms = await roomRes.json();

    normalizeLamps(rawLamps);
    normalizeRooms(rawRooms);

    initCategorySelect();
    initLampSelect();

    // optionally preselect first category + room
    const catEl = document.getElementById('categorySelect');
    if (catEl && catEl.options.length > 1) {
      catEl.selectedIndex = 1;
      selectedCategory = catEl.value;
      updateRoomOptions(selectedCategory);
    }
  } catch (err) {
    console.error('Gagal load data:', err);
    alert('Gagal memuat data lampu / ruangan. Cek console untuk detail.');
  }
}

function normalizeLamps(raw) {
  // Normalize to objects with { name, watt (Number), lumen (Number), ... }
  lamps = Array.isArray(raw) ? raw.map((l, i) => {
    const brand = l.brand ?? '';
    const model = l.model ?? '';
    const inferredName = (l.name ?? `${brand} ${model}`).trim();
    return {
      ...l,
      name: inferredName || `Lamp ${i + 1}`,
      watt: Number(l.watt) || 0,
      lumen: Number(l.lumen) || 0
    };
  }) : [];
}

function normalizeRooms(raw) {
  // Normalize rooms into { key, kategori, ruangan, tingkat_pencahayaan_lux (Number), subs: [...] }
  rooms = Array.isArray(raw) ? raw.map((r, idx) => {
    const key = r.key ?? toKey(r.ruangan) ?? `room_${idx + 1}`;
    const kategori = r.kategori ?? r.category ?? 'Umum';
    const ruangan = r.ruangan ?? r.name ?? `Ruangan ${idx + 1}`;
    const lux = parseLux(r.tingkat_pencahayaan_lux ?? r.lux);

    // handle various possible sub-array keys: sub, subs, children
    const rawSubs = r.subs ?? r.sub ?? r.children ?? [];
    const subs = Array.isArray(rawSubs) ? rawSubs.map((s, si) => {
      const sKey = s.key ?? toKey(s.nama ?? s.name ?? `${ruangan}_sub_${si + 1}`);
      const sNama = s.nama ?? s.name ?? `Sub ${si + 1}`;
      const sLux = parseLux(s.tingkat_pencahayaan_lux ?? s.lux ?? s.tingkat);
      const sLampu = Number(s.lampu ?? s.lamps ?? 0) || 0;
      return {
        ...s,
        key: sKey,
        nama: sNama,
        tingkat_pencahayaan_lux: sLux,
        lampu: sLampu
      };
    }) : [];

    // also allow property lampu at room level
    const lampuRoom = Number(r.lampu ?? r.lamps ?? 0) || 0;

    return {
      ...r,
      key,
      kategori,
      ruangan,
      tingkat_pencahayaan_lux: lux,
      lampu: lampuRoom,
      subs
    };
  }) : [];
}

/* ---------- UI Initialization ---------- */
function initCategorySelect() {
  const select = document.getElementById('categorySelect');
  if (!select) {
    console.warn('categorySelect element not found');
    return;
  }
  select.innerHTML = '<option value="">-- Pilih Kategori --</option>';

  const categories = [...new Set(rooms.map(r => r.kategori).filter(Boolean))];
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    select.appendChild(opt);
  });

  select.onchange = function () {
    selectedCategory = this.value;
    updateRoomOptions(selectedCategory);
  };
}

function updateRoomOptions(category) {
  const select = document.getElementById('roomSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Pilih Ruangan --</option>';

  const filtered = rooms.filter(r => r.kategori === category);
  filtered.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.key;
    opt.textContent = r.ruangan;
    select.appendChild(opt);
  });

  select.onchange = function () {
    selectedRoom = this.value;
    updateSubRoomOptions(selectedRoom);
  };

  if (select.options.length > 1) {
    select.selectedIndex = 1;
    selectedRoom = select.value;
    updateSubRoomOptions(selectedRoom);
  } else {
    selectedRoom = '';
    updateSubRoomOptions('');
  }
}

function updateSubRoomOptions(roomKey) {
  const select = document.getElementById('subRoomSelect');
  if (!select) return;
  select.innerHTML = '<option value="">-- Pilih Sub-Ruangan --</option>';
  select.disabled = true;
  selectedSubRoom = '';

  const room = rooms.find(r => r.key === roomKey);
  if (!room) return;

  if (Array.isArray(room.subs) && room.subs.length > 0) {
    room.subs.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.key;
      opt.textContent = s.nama;
      select.appendChild(opt);
    });
    select.disabled = false;
  }

  select.onchange = function () {
    selectedSubRoom = this.value;
  };

  if (select.options.length > 1) {
    select.selectedIndex = 1;
    selectedSubRoom = select.value;
  }
}

function initLampSelect() {
  const select = document.getElementById('lampSelect');
  if (!select) {
    console.warn('lampSelect element not found');
    return;
  }
  select.innerHTML = '<option value="">-- Pilih Lampu --</option>';

  lamps.forEach((l, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${l.name} — ${l.watt}W (${l.lumen} lm)`;
    select.appendChild(opt);
  });

  select.onchange = function () {
    selectedLampIndex = this.value === '' ? null : Number(this.value);
  };

  if (select.options.length > 1) {
    select.selectedIndex = 1;
    selectedLampIndex = Number(select.value);
  }
}

/* ---------- Calculation ---------- */
function calculate() {
  const length = parseFloat(document.getElementById('length').value);
  const width = parseFloat(document.getElementById('width').value);
  if (!isFinite(length) || !isFinite(width) || length <= 0 || width <= 0) {
    alert('Masukkan panjang & lebar ruangan yang valid (> 0).');
    return;
  }
  const area = length * width;

  const roomKey = document.getElementById('roomSelect').value;
  if (!roomKey) { alert('Pilih jenis ruangan terlebih dahulu.'); return; }
  const room = rooms.find(r => r.key === roomKey);
  if (!room) { alert('Data ruangan tidak ditemukan.'); return; }

  let luxReq = Number(room.tingkat_pencahayaan_lux) || 0;
  const subKey = document.getElementById('subRoomSelect') ? document.getElementById('subRoomSelect').value : '';
  if (subKey && Array.isArray(room.subs)) {
    const subObj = room.subs.find(s => s.key === subKey);
    if (subObj) luxReq = Number(subObj.tingkat_pencahayaan_lux) || luxReq;
  }

  if (selectedLampIndex === null) { alert('Pilih jenis lampu terlebih dahulu.'); return; }
  const lamp = lamps[selectedLampIndex];
  if (!lamp) { alert('Lampu tidak ditemukan.'); return; }

  const eta = parseFloat(document.getElementById('eta').value) || 0.8;

  const activeModeBtn = document.querySelector('#modeSeg .seg-btn.active');
  const mode = activeModeBtn ? activeModeBtn.dataset.mode : 'mode1';

  let jumlahLampu = 0;
  let totalWatt = 0;

  if (mode === 'mode1') {
    if (!lamp.lumen || lamp.lumen <= 0) { alert('Lumen lampu tidak valid untuk perhitungan mode 1.'); return; }
    jumlahLampu = Math.ceil((luxReq * area) / (lamp.lumen * eta));
    totalWatt = jumlahLampu * lamp.watt;
  } else {
    const useCalc = !!document.getElementById('use_calc').checked;
    if (useCalc) {
      if (!lamp.lumen || lamp.lumen <= 0) { alert('Lumen lampu tidak valid untuk perhitungan otomatis.'); return; }
      jumlahLampu = Math.ceil((luxReq * area) / (lamp.lumen * eta));
    } else {
      jumlahLampu = parseInt(document.getElementById('manual_count').value || '0', 10);
      if (!Number.isFinite(jumlahLampu) || jumlahLampu < 0) jumlahLampu = 0;
    }
    const kkkCount = parseInt(document.getElementById('kkk_count').value || '0', 10) || 0;
    const kkkWatt = parseInt(document.getElementById('kkk_watt').value || '0', 10) || 0;
    totalWatt = jumlahLampu * lamp.watt + kkkCount * kkkWatt;
  }

  const resultBox = document.getElementById('resultBox');
  resultBox.style.display = 'block';
  const subLabel = subKey ? ` - ${subKey}` : '';
  document.getElementById('resultText').innerHTML = `
    <b>${room.ruangan}${subLabel}</b> (${luxReq} lux)<br/>
    Luas: ${area.toFixed(2)} m²<br/>
    Lampu: ${lamp.name} — ${lamp.watt} W (${lamp.lumen} lm)<br/>
    Jumlah titik lampu: <b>${jumlahLampu}</b> unit<br/>
    Total Daya: <b>${totalWatt}</b> W
  `;

  drawVisualizer(length, width, jumlahLampu);
}

/* ---------- Visualizer ---------- */
function drawVisualizer(length, width, jumlahLampu) {
  const svg = document.getElementById('canvasSVG');
  if (!svg) return;
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const svgW = 900, svgH = 600;

  const svgns = 'http://www.w3.org/2000/svg';
  const rect = document.createElementNS(svgns, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width', String(svgW));
  rect.setAttribute('height', String(svgH));
  rect.setAttribute('fill', 'none');
  rect.setAttribute('stroke', '#00f2ff');
  rect.setAttribute('stroke-width', '3');
  svg.appendChild(rect);

  if (!Number.isFinite(jumlahLampu) || jumlahLampu <= 0) {
    document.getElementById('scaleInfo').textContent = `Skala: ${length}m × ${width}m`;
    return;
  }

  let cols = Math.ceil(Math.sqrt(jumlahLampu * (length / width)));
  cols = Math.max(cols, 1);
  let rows = Math.ceil(jumlahLampu / cols);
  rows = Math.max(rows, 1);

  let placed = 0;
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      if (placed >= jumlahLampu) break;
      const cx = (c * svgW) / (cols + 1);
      const cy = (r * svgH) / (rows + 1);
      const circle = document.createElementNS(svgns, 'circle');
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', '#ff0');
      circle.setAttribute('stroke', '#000');
      svg.appendChild(circle);
      placed++;
    }
  }

  document.getElementById('scaleInfo').textContent = `Skala: ${length}m × ${width}m`;
}

/* ---------- Export PNG ---------- */
function exportPNG() {
  const svg = document.getElementById('canvasSVG');
  if (!svg) { alert('Canvas tidak ditemukan.'); return; }

  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  const img = new Image();
  img.onload = function () {
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = 'denah_lampu.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.onerror = function (e) {
    URL.revokeObjectURL(url);
    console.error('Gagal mengonversi SVG ke PNG', e);
    alert('Gagal mengekspor PNG. Cek console.');
  };
  img.src = url;
}

/* ---------- Event wiring ---------- */
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  document.querySelectorAll('#modeSeg .seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modeSeg .seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const showMode2 = btn.dataset.mode === 'mode2';
      const mode2fields = document.getElementById('mode2fields');
      if (mode2fields) mode2fields.style.display = showMode2 ? 'block' : 'none';
    });
  });

  const calcBtn = document.getElementById('btnCalculate');
  if (calcBtn) calcBtn.addEventListener('click', (e) => { e.preventDefault(); calculate(); });

  const exportBtn = document.getElementById('btnExportPng');
  if (exportBtn) exportBtn.addEventListener('click', (e) => { e.preventDefault(); exportPNG(); });
});
