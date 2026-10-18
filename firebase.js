// firebase.js — MapGame multiplayer via Cloud Firestore.
//
// Family model: the join code IS the login. Nobody signs in with a real
// account — every phone uses invisible anonymous auth. One person creates a
// family and gets a code (e.g. JX7K-2P4Q); everyone else joins with the code.
// Trips live at families/{CODE}/trips/{tripId}, so each family only ever sees
// its own. The code is the document ID: unguessable, and the security rules
// forbid listing families, so codes can't be enumerated.
//
// How it works:
//   * Anonymous sign-in on launch (invisible).
//   * No family code stored -> a family gate overlay (create / join / solo).
//   * With a code: first run merges this device's local trips into the
//     family's trips (matched by trip name and member name — no duplicates,
//     member ids normalized to the shared ones). Later runs just heal gaps.
//   * Live onSnapshot subscription: anyone's tap appears on every phone.
//   * Writes go through atomically (arrayUnion/arrayRemove) and Firestore
//     queues while offline + IndexedDB persistence covers dead zones.
//   * Per-device prefs (region, viewer, color mode, active trip, "this device
//     is", family code itself) stay in localStorage only — never synced.
//
// Loading is lazy: app.js does import('./firebase.js'), so if the SDK can't
// load (offline first launch, blocked CDN) the app simply stays local-only.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC9nE4Q-8bZuddZ19r5t-SrjnEJwoKD65c",
  authDomain: "mapgame-51770.firebaseapp.com",
  projectId: "mapgame-51770",
  storageBucket: "mapgame-51770.firebasestorage.app",
  messagingSenderId: "626638923683",
  appId: "1:626638923683:web:c6bf1d866cd3afef83dc16",
};
// NOTE: this key is public by design — every Firebase web app ships it in
// client code. The security rules (firestore.rules) are what protect the data.

const SDK = 'https://www.gstatic.com/firebasejs/12.2.1';
const FAMILY_KEY = 'mapgame.familyCode';
const FAMILY_NAME_KEY = 'mapgame.familyName';
const SOLO_KEY = 'mapgame.solo';
const MERGE_PREFIX = 'mapgame.merged.';

// Readable alphabet: no 0/O, 1/I/L to avoid mix-ups when reading a code aloud.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

let started = false;

export async function initFirebase(store, storage) {
  if (started) return;
  try {
    const [appMod, authMod, fs] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-auth.js`),
      import(`${SDK}/firebase-firestore.js`),
    ]);
    const app = appMod.initializeApp(FIREBASE_CONFIG);
    await authMod.signInAnonymously(authMod.getAuth(app));
    let db;
    try {
      db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() });
    } catch (e) {
      db = fs.getFirestore(app); // already initialized — fall back to memory cache
    }
    const F = {
      collection: fs.collection, doc: fs.doc, setDoc: fs.setDoc,
      getDoc: fs.getDoc, getDocs: fs.getDocs, updateDoc: fs.updateDoc, deleteDoc: fs.deleteDoc,
      onSnapshot: fs.onSnapshot, arrayUnion: fs.arrayUnion, arrayRemove: fs.arrayRemove,
      runTransaction: (fn) => fs.runTransaction(db, fn),
    };

    const code = normCode(safeGet(storage, FAMILY_KEY));
    if (!code) {
      wireNoFamilyRow(storage);
      if (!safeGet(storage, SOLO_KEY)) showFamilyGate(store, storage, db, F);
      started = true; // gate (or solo choice) owns the flow from here
      return;
    }
    started = true;
    await startFamilySync(store, storage, db, F, code);
  } catch (e) {
    // Offline, bad config, or permission-denied: stay in local mode; a later
    // 'online' event retries.
    console.warn('[firebase] unavailable — local mode for now', e);
  }
}

async function startFamilySync(store, storage, db, F, code) {
  // The family may have been deleted (or the code mistyped long ago).
  const famSnap = await F.getDoc(F.doc(db, 'families', code));
  if (!famSnap.exists()) {
    safeDel(storage, FAMILY_KEY);
    safeDel(storage, FAMILY_NAME_KEY);
    started = false;
    showFamilyGate(store, storage, db, F, 'That family wasn\u2019t found — it may have been deleted.');
    return;
  }
  safeSet(storage, FAMILY_NAME_KEY, famSnap.data().name || '');

  const tripsCol = F.collection(db, 'families', code, 'trips');
  store.attachRemote(makeAdapter(db, F, code));

  const firstRun = !safeGet(storage, MERGE_PREFIX + code);
  const snap = await F.getDocs(tripsCol);
  await syncLocalToRemote(db, F, code, snap, store, firstRun);
  safeSet(storage, MERGE_PREFIX + code, '1');

  F.onSnapshot(tripsCol,
    (s) => {
      const trips = [];
      s.forEach((d) => trips.push(deserializeTrip(d.id, d.data())));
      store.ingestRemoteTrips(trips);
    },
    (err) => console.warn('[firebase] live sync error', err));
  renderFamilyRow(storage, code);
  console.log('[firebase] family sync live:', code);
}

function safeGet(storage, k) { try { return storage.getItem(k); } catch (e) { return null; } }
function safeSet(storage, k, v) { try { storage.setItem(k, v); } catch (e) {} }
function safeDel(storage, k) { try { storage.removeItem(k); } catch (e) {} }

// ---------------------------------------------------------------------------
// Pure helpers (no Firestore dependency — unit-testable in Node)
// ---------------------------------------------------------------------------

export function normName(n) { return (n || '').trim().toLowerCase(); }

// 8 random chars from the readable alphabet.
export function genCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// Normalize what someone typed: uppercase, forgiving of dashes/spaces and
// 0/O, 1/I mix-ups.
export function normCode(input) {
  return (input || '').toUpperCase().replace(/0/g, 'O').replace(/1/g, 'I').replace(/[^A-Z0-9]/g, '');
}

export function prettyCode(code) {
  const c = normCode(code);
  return c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c;
}

// Firestore doc for a trip. deviceMemberId is per-device and never synced.
export function serializeTrip(t) {
  return {
    name: t.name,
    createdAt: t.createdAt,
    members: (t.members || []).map((m) => ({ id: m.id, name: m.name, color: m.color })),
    spots_US: (t.spots && t.spots.US) || {},
    spots_CA: (t.spots && t.spots.CA) || {},
    spots_EU: (t.spots && t.spots.EU) || [],
  };
}

export function deserializeTrip(id, data) {
  return {
    id,
    name: data.name,
    createdAt: data.createdAt,
    members: (data.members || []).map((m) => ({ id: m.id, name: m.name, color: m.color })),
    deviceMemberId: null, // re-attached from local state on ingest
    spots: {
      US: data.spots_US || {},
      CA: data.spots_CA || {},
      EU: data.spots_EU || [],
    },
  };
}

// A trip with no members and no spots isn't worth uploading — the real data
// wins through the live snapshot instead.
function tripHasData(t) {
  if ((t.members || []).length) return true;
  const s = t.spots || {};
  if ((s.EU || []).length) return true;
  return ['US', 'CA'].some((r) => Object.values(s[r] || {}).some((a) => a && a.length));
}

// Merge planner: local trip + remote doc data (or null) ->
//   { create: docData }                    — no remote match, upload as-is
//   { idMap, membersToAdd, spotUnions }    — merge into the remote doc,
//     remapping local member ids to the remote ones (matched by name).
export function planMerge(localTrip, remoteData) {
  if (!remoteData) return { create: serializeTrip(localTrip) };
  const idMap = {};
  const membersToAdd = [];
  for (const m of localTrip.members) {
    const rm = (remoteData.members || []).find((x) => normName(x.name) === normName(m.name));
    if (rm) idMap[m.id] = rm.id;
    else { idMap[m.id] = m.id; membersToAdd.push({ id: m.id, name: m.name, color: m.color }); }
  }
  // Spots already on the remote doc (by member) are skipped — union, no dupes.
  const missing = (localArr, remoteArr) =>
    (localArr || [])
      .filter((s) => !(remoteArr || []).some((r) => r.memberId === idMap[s.memberId]))
      .map((s) => ({ memberId: idMap[s.memberId], at: s.at }));
  const spotUnions = [];
  for (const region of ['US', 'CA']) {
    const lb = localTrip.spots[region] || {};
    const rb = remoteData[`spots_${region}`] || {};
    for (const code of Object.keys(lb)) {
      const miss = missing(lb[code], rb[code]);
      if (miss.length) spotUnions.push({ path: `spots_${region}.${code}`, spots: miss });
    }
  }
  const missEU = missing(localTrip.spots.EU, remoteData.spots_EU);
  if (missEU.length) spotUnions.push({ path: 'spots_EU', spots: missEU });
  return { idMap, membersToAdd, spotUnions };
}

// ---------------------------------------------------------------------------
// Firestore read/write
// ---------------------------------------------------------------------------

function makeAdapter(db, F, code) {
  const ref = (tripId) => F.doc(db, 'families', code, 'trips', tripId);
  const spotsPath = (region, c) => (region === 'EU' ? 'spots_EU' : `spots_${region}.${c}`);
  const strip = (m) => ({ id: m.id, name: m.name, color: m.color });
  return {
    pushAddTrip(trip) { return F.setDoc(ref(trip.id), serializeTrip(trip)); },
    pushRenameTrip(id, name) { return F.updateDoc(ref(id), { name }); },
    pushDeleteTrip(id) { return F.deleteDoc(ref(id)); },
    pushAddMember(tripId, member) {
      return F.updateDoc(ref(tripId), { members: F.arrayUnion(strip(member)) });
    },
    // id-based (not arrayRemove) so a remotely-changed color can't block it
    pushRemoveMember(tripId, memberId) {
      return F.runTransaction(async (tx) => {
        const snap = await tx.get(ref(tripId));
        if (!snap.exists()) return;
        tx.update(ref(tripId), { members: (snap.data().members || []).filter((m) => m.id !== memberId) });
      });
    },
    pushSetMemberColor(tripId, memberId, color) {
      return F.runTransaction(async (tx) => {
        const snap = await tx.get(ref(tripId));
        if (!snap.exists()) return;
        tx.update(ref(tripId), {
          members: (snap.data().members || []).map((m) => (m.id === memberId ? { ...m, color } : m)),
        });
      });
    },
    pushAddSpot(tripId, region, c, spot) {
      return F.updateDoc(ref(tripId), { [spotsPath(region, c)]: F.arrayUnion(spot) });
    },
    pushRemoveSpot(tripId, region, c, spot) {
      return F.updateDoc(ref(tripId), { [spotsPath(region, c)]: F.arrayRemove(spot) });
    },
  };
}

async function createFamily(db, F, name) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = genCode();
    const ref = F.doc(db, 'families', code);
    if ((await F.getDoc(ref)).exists()) continue; // astronomically unlikely; retry
    await F.setDoc(ref, { name: name.slice(0, 60), createdAt: Date.now(), joinCode: prettyCode(code) });
    return code;
  }
  throw new Error('could not generate a unique family code');
}

// One-time (and self-healing) upload of local trips into the family.
// Idempotent: re-running it never duplicates anything.
async function syncLocalToRemote(db, F, code, snap, store, matchNames) {
  const remoteById = new Map();
  const remoteByName = new Map();
  snap.forEach((d) => {
    remoteById.set(d.id, d.data());
    if (matchNames) remoteByName.set(normName(d.data().name), d.id);
  });
  const mergedRemoteIds = new Set();
  for (const t of [...store.state.trips]) {
    if (remoteById.has(t.id)) { await healTrip(db, F, code, t, remoteById.get(t.id)); continue; }
    if (!tripHasData(t)) continue; // blank local trip — real data wins via ingest
    let remoteId = null;
    if (matchNames) {
      const mid = remoteByName.get(normName(t.name));
      if (mid && !mergedRemoteIds.has(mid)) remoteId = mid;
    }
    if (remoteId) {
      const plan = planMerge(t, remoteById.get(remoteId));
      store.remapTripMembers(t.id, plan.idMap); // local "Dad" becomes the shared "Dad"
      const ref = F.doc(db, 'families', code, 'trips', remoteId);
      if (plan.membersToAdd.length) await F.updateDoc(ref, { members: F.arrayUnion(...plan.membersToAdd) });
      for (const u of plan.spotUnions) await F.updateDoc(ref, { [u.path]: F.arrayUnion(...u.spots) });
      store.adoptTripId(t.id, remoteId);
      mergedRemoteIds.add(remoteId);
    } else {
      const ref = F.doc(db, 'families', code, 'trips', t.id);
      await F.setDoc(ref, serializeTrip(t));
      remoteById.set(t.id, serializeTrip(t));
    }
  }
}

// Fill gaps from writes that failed earlier (e.g. before rules were live).
// Union-only: never deletes, so it can't clobber anyone.
async function healTrip(db, F, code, t, remoteData) {
  const ref = F.doc(db, 'families', code, 'trips', t.id);
  const updates = {};
  const rMembers = remoteData.members || [];
  const missingMembers = t.members
    .filter((m) => !rMembers.some((x) => x.id === m.id))
    .map((m) => ({ id: m.id, name: m.name, color: m.color }));
  if (missingMembers.length) updates.members = F.arrayUnion(...missingMembers);
  if (t.name !== remoteData.name) updates.name = t.name;
  const missingSpots = (localArr, remoteArr) =>
    (localArr || []).filter((s) => !(remoteArr || []).some((r) => r.memberId === s.memberId));
  for (const region of ['US', 'CA']) {
    const lb = t.spots[region] || {};
    const rb = remoteData[`spots_${region}`] || {};
    for (const code of Object.keys(lb)) {
      const miss = missingSpots(lb[code], rb[code]);
      if (miss.length) updates[`spots_${region}.${code}`] = F.arrayUnion(...miss);
    }
  }
  const missEU = (t.spots.EU || []).filter((s) =>
    !(remoteData.spots_EU || []).some((r) => r.memberId === s.memberId && r.at === s.at));
  if (missEU.length) updates.spots_EU = F.arrayUnion(...missEU);
  if (Object.keys(updates).length) await F.updateDoc(ref, updates);
}

// ---------------------------------------------------------------------------
// Family gate UI (create / join / solo) + family row in the members modal
// ---------------------------------------------------------------------------

function showFamilyGate(store, storage, db, F, notice) {
  const $ = (id) => document.getElementById(id);
  const gate = $('familyGate');
  if (!gate) return;
  gate.hidden = false;
  const panes = ['gateMain', 'gateCreateForm', 'gateJoinForm', 'gateCodeShow'];
  const show = (id) => panes.forEach((p) => { $(p).hidden = p !== id; });
  const err = (id, msg) => { const e = $(id); e.textContent = msg || ''; e.hidden = !msg; };
  if (notice) {
    const t = document.getElementById('toast');
    if (t) { t.textContent = notice; t.hidden = false; setTimeout(() => { t.hidden = true; }, 5000); }
  }

  $('gateCreate').onclick = () => { show('gateCreateForm'); err('gateCreateErr'); $('familyNameInput').focus(); };
  $('gateJoin').onclick = () => { show('gateJoinForm'); err('gateJoinErr'); $('familyCodeInput').focus(); };
  $('gateCreateBack').onclick = $('gateJoinBack').onclick = () => show('gateMain');
  $('gateSolo').onclick = () => { safeSet(storage, SOLO_KEY, '1'); gate.hidden = true; };

  $('gateCreateGo').onclick = async () => {
    const name = $('familyNameInput').value.trim();
    if (!name) { err('gateCreateErr', 'Give your family a name first.'); return; }
    $('gateCreateGo').disabled = true;
    err('gateCreateErr');
    try {
      const code = await createFamily(db, F, name);
      safeSet(storage, FAMILY_KEY, code);
      safeSet(storage, FAMILY_NAME_KEY, name);
      $('gateBigCode').textContent = prettyCode(code);
      show('gateCodeShow');
    } catch (e) {
      err('gateCreateErr', 'Couldn\u2019t create the family — check your connection and try again.');
    }
    $('gateCreateGo').disabled = false;
  };
  $('gateJoinGo').onclick = async () => {
    const code = normCode($('familyCodeInput').value);
    if (code.length !== 8) { err('gateJoinErr', 'Codes look like XXXX-XXXX — check it and try again.'); return; }
    $('gateJoinGo').disabled = true;
    err('gateJoinErr');
    try {
      const snap = await F.getDoc(F.doc(db, 'families', code));
      if (!snap.exists()) {
        err('gateJoinErr', 'No family found with that code — check it and try again.');
      } else {
        safeSet(storage, FAMILY_KEY, code);
        safeSet(storage, FAMILY_NAME_KEY, snap.data().name || '');
        location.reload(); // fresh boot merges into the family
        return;
      }
    } catch (e) {
      err('gateJoinErr', 'Couldn\u2019t join — check your connection and try again.');
    }
    $('gateJoinGo').disabled = false;
  };
  $('gateCodeGo').onclick = () => location.reload(); // fresh boot merges local trips in
}

// Family chip at the top of the members modal, with a Leave button.
function renderFamilyRow(storage, code) {
  const row = document.getElementById('familyRow');
  if (!row) return;
  document.getElementById('familyName').textContent = safeGet(storage, FAMILY_NAME_KEY) || 'Family';
  document.getElementById('familyCode').textContent = 'Code: ' + prettyCode(code);
  row.hidden = false;
  document.getElementById('familyLeave').onclick = () => {
    if (!confirm('Leave this family? Its trips stay saved for everyone else; this device just stops syncing.')) return;
    safeDel(storage, FAMILY_KEY);
    safeDel(storage, FAMILY_NAME_KEY);
    location.reload();
  };
}

// "Family setup" row in the members modal when there's no family yet —
// clears the solo choice and reloads so the gate appears.
function wireNoFamilyRow(storage) {
  const row = document.getElementById('noFamilyRow');
  if (!row) return;
  row.hidden = false;
  document.getElementById('familySetup').onclick = () => {
    safeDel(storage, SOLO_KEY);
    location.reload();
  };
}
