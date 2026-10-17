// app.js — MapGame UI.
//
// The whole screen is: an always-visible top bar (title + counter, region
// toggle, trip dropdown, viewer dropdown, color-mode toggle) and a big tappable
// map underneath. All game data lives in store.js; this file only renders it
// and turns taps into store calls.

import { createStore, PALETTE, COMBINED_COLOR, REGIONS } from './store.js';

// ---------------------------------------------------------------------------
// Static data: region codes + display names (the SVG files use these codes
// as each state's path id).
// ---------------------------------------------------------------------------

const STATE_NAMES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const PROVINCE_NAMES = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
};

const REGION_CODES = { US: Object.keys(STATE_NAMES), CA: Object.keys(PROVINCE_NAMES) };
const REGION_FILE = { US: 'maps/us.svg', CA: 'maps/ca.svg' };

// How long to wait after a tap before calling it a single tap (a second tap
// inside this window makes it a double tap = undo). 300ms feels instant enough
// for kids while reliably catching double taps.
const TAP_DELAY_MS = 300;
// If the finger moves more than this between press and release, it was a
// pan/pinch, not a tap.
const TAP_SLOP_PX = 12;

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const store = createStore(safeStorage());

function safeStorage() {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch (e) { /* private mode etc. */ }
  const mem = {};
  return { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
}

const $ = (id) => document.getElementById(id);
const els = {
  countText: $('countText'), progressFill: $('progressFill'), progressWrap: $('progressWrap'),
  regionSeg: $('regionSeg'), tripSelect: $('tripSelect'), tripAdd: $('tripAdd'),
  viewerSelect: $('viewerSelect'), modeSeg: $('modeSeg'), membersBtn: $('membersBtn'),
  mapHolder: $('mapHolder'), europeCard: $('europeCard'),
  euCount: $('euCount'), euPlus: $('euPlus'), euUndo: $('euUndo'), euList: $('euList'),
  missingBox: $('missingBox'), missingSummary: $('missingSummary'), missingList: $('missingList'),
  sheet: $('sheet'), sheetCard: $('sheetCard'), sheetTitle: $('sheetTitle'),
  sheetRows: $('sheetRows'), sheetUnmark: $('sheetUnmark'), sheetClose: $('sheetClose'),
  modal: $('membersModal'), modalCard: $('modalCard'),
  deviceChips: $('deviceChips'), memberRows: $('memberRows'),
  newName: $('newName'), paletteRow: $('paletteRow'), addMemberBtn: $('addMemberBtn'),
  tripNameLabel: $('tripNameLabel'), tripRename: $('tripRename'), tripDelete: $('tripDelete'),
  modalClose: $('modalClose'), toast: $('toast'),
};

// Which palette swatch is selected in the "add member" form.
let pickedColor = null;

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

// Spotters for a code, filtered by the viewer dropdown ("Whole group" = union
// of everyone; a name = just that person's spots).
function visibleSpotters(region, code) {
  const all = store.spottersFor(region, code);
  if (store.state.viewer === 'group') return all;
  return all.filter((s) => s.memberId === store.state.viewer);
}

function renderTopBar() {
  const region = store.state.region;
  const info = REGIONS[region];

  // counter
  if (region === 'EU') {
    const n = store.countSpotted('EU');
    els.countText.textContent = `${n} EU plate${n === 1 ? '' : 's'}`;
    els.progressWrap.style.display = 'none';
  } else {
    const codes = REGION_CODES[region];
    const n = store.countSpotted(region, codes);
    els.countText.textContent = `${n}/${info.total} ${info.unit}`;
    els.progressWrap.style.display = '';
    els.progressFill.style.width = `${(n / info.total) * 100}%`;
  }

  // region toggle
  for (const btn of els.regionSeg.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.region === region);
    btn.setAttribute('aria-pressed', btn.dataset.region === region ? 'true' : 'false');
  }

  // trip dropdown (rebuild so new/renamed trips show up, keep selection)
  const trips = store.state.trips;
  els.tripSelect.innerHTML = '';
  for (const t of trips) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    els.tripSelect.appendChild(opt);
  }
  els.tripSelect.value = store.state.activeTripId;

  // viewer dropdown: Whole group + one entry per member
  const viewer = store.state.viewer;
  els.viewerSelect.innerHTML = '';
  const groupOpt = document.createElement('option');
  groupOpt.value = 'group';
  groupOpt.textContent = 'Whole group';
  els.viewerSelect.appendChild(groupOpt);
  for (const m of store.trip.members) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    els.viewerSelect.appendChild(opt);
  }
  els.viewerSelect.value = viewer;

  // color-mode toggle
  for (const btn of els.modeSeg.querySelectorAll('button')) {
    btn.classList.toggle('active', btn.dataset.mode === store.state.colorMode);
  }
}

// Paint every state/province path: unmarked gray, one solid color, or a
// blended gradient when 2+ people spotted it (individual mode).
function renderMap() {
  const region = store.state.region;
  const svg = els.mapHolder.querySelector('svg');
  if (!svg || (region !== 'US' && region !== 'CA')) return;

  const codes = REGION_CODES[region];
  const combined = store.state.colorMode === 'combined';

  // Rebuild the gradient defs from scratch each render — simple and always
  // correct, and 50 tiny gradients are cheap.
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }
  let defsHtml = '';

  for (const code of codes) {
    const path = svg.querySelector(`#${CSS.escape(code)}`);
    if (!path) continue;
    const spotterIds = [...new Set(visibleSpotters(region, code).map((s) => s.memberId))];

    if (spotterIds.length === 0) {
      path.removeAttribute('fill');
      path.classList.remove('spotted');
      continue;
    }
    path.classList.add('spotted');

    if (combined || spotterIds.length === 1) {
      const color = combined ? COMBINED_COLOR : store.memberColor(spotterIds[0]);
      path.setAttribute('fill', color);
    } else {
      // Blend: a diagonal gradient with one stop per spotter's color,
      // spread evenly across the state.
      const colors = spotterIds.map((id) => store.memberColor(id));
      const stops = colors
        .map((c, i) => {
          const pct = colors.length === 1 ? 0 : (i / (colors.length - 1)) * 100;
          return `<stop offset="${pct.toFixed(1)}%" stop-color="${c}"/>`;
        })
        .join('');
      defsHtml += `<linearGradient id="g-${code}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`;
      path.setAttribute('fill', `url(#g-${code})`);
    }
  }
  defs.innerHTML = defsHtml;

  // "Still missing" list under the map
  const names = region === 'US' ? STATE_NAMES : PROVINCE_NAMES;
  const missing = store.missingCodes(region, codes);
  els.missingBox.style.display = '';
  els.missingSummary.textContent = `Still missing (${missing.length})`;
  els.missingList.innerHTML = '';
  for (const code of missing) {
    const chip = document.createElement('span');
    chip.className = 'missing-chip';
    chip.textContent = names[code];
    els.missingList.appendChild(chip);
  }
}

function renderEurope() {
  const region = store.state.region;
  const show = region === 'EU';
  els.europeCard.hidden = !show;
  els.mapHolder.style.display = show ? 'none' : '';
  els.missingBox.style.display = show ? 'none' : '';
  if (!show) return;

  const spots = visibleSpotters('EU').slice().reverse(); // newest first
  els.euCount.textContent = spots.length;
  els.euList.innerHTML = '';
  for (const s of spots.slice(0, 30)) {
    const li = document.createElement('li');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = store.memberColor(s.memberId);
    li.appendChild(dot);
    li.appendChild(document.createTextNode(`${store.memberName(s.memberId)} — ${timeAgo(s.at)}`));
    els.euList.appendChild(li);
  }
}

function renderAll() {
  renderTopBar();
  renderMap();
  renderEurope();
}

// ---------------------------------------------------------------------------
// Map loading + tap handling
// ---------------------------------------------------------------------------

async function loadMap() {
  const region = store.state.region;
  if (region === 'EU') { renderAll(); return; }
  try {
    const res = await fetch(REGION_FILE[region]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    els.mapHolder.innerHTML = await res.text();
    wireTapHandling(els.mapHolder.querySelector('svg'));
  } catch (e) {
    els.mapHolder.innerHTML = `<p class="map-error">Couldn't load the map. Check your connection and reopen the app.</p>`;
  }
  renderAll();
}

function wireTapHandling(svg) {
  if (!svg) return;
  let downX = 0, downY = 0, downT = 0;
  let pending = null; // { code, timer } — a tap waiting to see if tap #2 arrives

  function pathForEvent(e) {
    const p = e.target.closest ? e.target.closest('path.region') : null;
    if (!p || p.hasAttribute('data-inert')) return null;
    return p;
  }

  svg.addEventListener('pointerdown', (e) => {
    downX = e.clientX; downY = e.clientY; downT = Date.now();
  });

  svg.addEventListener('pointerup', (e) => {
    const path = pathForEvent(e);
    if (!path) return;
    // Finger slid (pan/pinch) or pressed too long: not a tap.
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > TAP_SLOP_PX || Date.now() - downT > 600) { cancelPending(); return; }

    const code = path.id;
    if (pending && pending.code === code) {
      // Second tap inside the window = double tap = undo.
      cancelPending();
      onDoubleTap(code);
    } else {
      cancelPending();
      pending = {
        code,
        timer: setTimeout(() => { pending = null; onSingleTap(code); }, TAP_DELAY_MS),
      };
    }
  });

  function cancelPending() {
    if (pending) { clearTimeout(pending.timer); pending = null; }
  }
}

// Who is tapping? Whoever claimed this device. If nobody has, ask first.
function deviceMember() {
  return store.trip.members.find((m) => m.id === store.trip.deviceMemberId) || null;
}

function requireDeviceMember() {
  const me = deviceMember();
  if (!me) {
    openModal();
    toast(store.trip.members.length
      ? 'Tap your name under "This device is" first'
      : 'Add your family members first, then tap your name');
    return null;
  }
  return me;
}

function onSingleTap(code) {
  const me = requireDeviceMember();
  if (!me) return;
  const region = store.state.region;

  if (store.hasSpot(region, code, me.id)) {
    // Already marked by me: show who spotted it and when.
    openSheet(region, code);
    return;
  }
  store.addSpot(region, code, me.id);
  const names = region === 'US' ? STATE_NAMES : PROVINCE_NAMES;
  toast(`Marked ${names[code]}!`);
}

function onDoubleTap(code) {
  const me = requireDeviceMember();
  if (!me) return;
  const region = store.state.region;
  if (store.removeSpot(region, code, me.id)) {
    const names = region === 'US' ? STATE_NAMES : PROVINCE_NAMES;
    toast(`Undid ${names[code]}`);
  } else {
    toast('Nothing of yours to undo here');
  }
}

// ---------------------------------------------------------------------------
// Detail sheet (tap an already-spotted state)
// ---------------------------------------------------------------------------

function openSheet(region, code) {
  const names = region === 'US' ? STATE_NAMES : PROVINCE_NAMES;
  els.sheetTitle.textContent = names[code];
  els.sheetRows.innerHTML = '';

  const spotters = visibleSpotters(region, code);
  const seen = new Set();
  for (const s of spotters) {
    if (seen.has(s.memberId)) continue;
    seen.add(s.memberId);
    const row = document.createElement('div');
    row.className = 'sheet-row';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = store.memberColor(s.memberId);
    row.appendChild(dot);
    row.appendChild(document.createTextNode(`${store.memberName(s.memberId)} — ${timeAgo(s.at)}`));
    els.sheetRows.appendChild(row);
  }
  if (!spotters.length) {
    els.sheetRows.textContent = 'No spots here in this view.';
  }

  const me = deviceMember();
  const mine = me && store.hasSpot(region, code, me.id);
  els.sheetUnmark.style.display = mine ? '' : 'none';
  els.sheetUnmark.onclick = () => {
    store.removeSpot(region, code, me.id);
    closeSheet();
    toast(`Undid ${names[code]}`);
  };

  els.sheet.hidden = false;
}

function closeSheet() { els.sheet.hidden = true; }

// ---------------------------------------------------------------------------
// Members modal (device identity, add/remove/recolor, trip rename/delete)
// ---------------------------------------------------------------------------

function openModal() {
  pickedColor = store.nextFreeColor();
  renderModal();
  els.modal.hidden = false;
}
function closeModal() { els.modal.hidden = true; }

function renderModal() {
  const t = store.trip;
  const draftName = els.newName.value; // don't wipe a half-typed name on re-render

  // "This device is" chips
  els.deviceChips.innerHTML = '';
  if (!t.members.length) {
    els.deviceChips.innerHTML = '<p class="hint">No members yet — add your family below.</p>';
  }
  for (const m of t.members) {
    const chip = document.createElement('button');
    chip.className = 'chip' + (t.deviceMemberId === m.id ? ' selected' : '');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = m.color;
    chip.appendChild(dot);
    chip.appendChild(document.createTextNode(m.name));
    chip.onclick = () => { store.setDeviceMember(m.id); renderModal(); };
    els.deviceChips.appendChild(chip);
  }

  // member rows
  els.memberRows.innerHTML = '';
  for (const m of t.members) {
    const row = document.createElement('div');
    row.className = 'member-row';

    const dotBtn = document.createElement('button');
    dotBtn.className = 'dot big';
    dotBtn.style.background = m.color;
    dotBtn.title = `Change ${m.name}'s color`;
    dotBtn.setAttribute('aria-label', `Change ${m.name}'s color`);
    dotBtn.onclick = () => openColorPicker(row, m);

    const name = document.createElement('span');
    name.className = 'member-name';
    name.textContent = m.name;

    const del = document.createElement('button');
    del.className = 'icon-btn danger';
    del.textContent = '×';
    del.title = `Remove ${m.name}`;
    del.setAttribute('aria-label', `Remove ${m.name}`);
    del.onclick = () => {
      if (confirm(`Remove ${m.name}? Their old spots stay on the map.`)) {
        store.removeMember(m.id);
        renderModal();
      }
    };

    row.appendChild(dotBtn);
    row.appendChild(name);
    row.appendChild(del);
    els.memberRows.appendChild(row);
  }

  // add-member form
  els.newName.value = draftName;
  const onPickNew = (c) => {
    pickedColor = c;
    renderPalette(els.paletteRow, pickedColor, onPickNew);
  };
  renderPalette(els.paletteRow, pickedColor, onPickNew);

  // trip section
  els.tripNameLabel.textContent = t.name;
}

function renderPalette(container, selected, onPick) {
  container.innerHTML = '';
  for (const c of PALETTE) {
    const b = document.createElement('button');
    b.className = 'swatch' + (c === selected ? ' selected' : '');
    b.style.background = c;
    b.setAttribute('aria-label', `Color ${c}`);
    b.onclick = () => onPick(c);
    container.appendChild(b);
  }
}

// Small inline palette to recolor an existing member.
function openColorPicker(anchorRow, member) {
  closeColorPicker();
  const pop = document.createElement('div');
  pop.className = 'color-pop';
  pop.id = 'colorPop';
  renderPalette(pop, member.color, (c) => {
    store.setMemberColor(member.id, c);
    closeColorPicker();
    renderModal();
  });
  anchorRow.appendChild(pop);
  setTimeout(() => document.addEventListener('pointerdown', dismissColorPicker), 0);
}
function dismissColorPicker(e) {
  const pop = document.getElementById('colorPop');
  if (pop && !pop.contains(e.target)) closeColorPicker();
}
function closeColorPicker() {
  document.removeEventListener('pointerdown', dismissColorPicker);
  document.getElementById('colorPop')?.remove();
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function timeAgo(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(ts).toLocaleDateString();
}

let toastTimer = null;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 1600);
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

function init() {
  // region toggle
  for (const btn of els.regionSeg.querySelectorAll('button')) {
    btn.onclick = () => { store.setRegion(btn.dataset.region); loadMap(); };
  }
  // color-mode toggle
  for (const btn of els.modeSeg.querySelectorAll('button')) {
    btn.onclick = () => store.setColorMode(btn.dataset.mode);
  }

  els.tripSelect.onchange = () => store.setActiveTrip(els.tripSelect.value);
  els.tripAdd.onclick = () => {
    const name = prompt('Name the new trip:', `Road Trip ${store.state.trips.length + 1}`);
    if (name !== null) store.addTrip(name); // null = they hit Cancel
  };
  els.viewerSelect.onchange = () => store.setViewer(els.viewerSelect.value);
  els.membersBtn.onclick = openModal;
  els.modalClose.onclick = closeModal;
  els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeModal(); });

  els.sheetClose.onclick = closeSheet;
  els.sheet.addEventListener('click', (e) => { if (e.target === els.sheet) closeSheet(); });

  els.addMemberBtn.onclick = () => {
    const name = els.newName.value.trim();
    if (!name) { toast('Type a name first'); els.newName.focus(); return; }
    store.addMember(name, pickedColor);
    pickedColor = store.nextFreeColor();
    els.newName.value = '';
    renderModal();
  };
  els.newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') els.addMemberBtn.click(); });

  els.tripRename.onclick = () => {
    const name = prompt('Rename trip:', store.trip.name);
    if (name !== null) { store.renameTrip(store.trip.id, name); renderModal(); }
  };
  els.tripDelete.onclick = () => {
    if (store.state.trips.length <= 1) { toast('You need at least one trip'); return; }
    if (confirm(`Delete "${store.trip.name}" and its map?`)) {
      store.deleteTrip(store.trip.id);
      closeModal();
    }
  };

  // Europe card
  els.euPlus.onclick = () => {
    const me = requireDeviceMember();
    if (!me) return;
    store.addSpot('EU', null, me.id);
    toast('Marked a European plate!');
  };
  els.euUndo.onclick = () => {
    const me = requireDeviceMember();
    if (!me) return;
    toast(store.removeSpot('EU', null, me.id) ? 'Undid your last EU plate' : 'Nothing of yours to undo');
  };

  // Re-render everything whenever the store changes.
  // (When Firestore sync lands later, remote changes will flow through this
  // same callback — no UI changes needed.)
  store.onChange(renderAll);

  // Escape closes overlays.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); closeModal(); closeColorPicker(); }
  });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  loadMap();

  // First run: no family yet — open the members panel so they set it up.
  if (!store.trip.members.length) {
    setTimeout(openModal, 400);
  }
}

document.addEventListener('DOMContentLoaded', init);
