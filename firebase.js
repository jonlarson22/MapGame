// firebase.js — MapGame multiplayer via Cloud Firestore.
//
// How it works:
//   * Every phone signs in anonymously on launch (invisible, no UI).
//   * Firestore is the shared source of truth for trips (members + spots).
//     Writes go through atomically (arrayUnion/arrayRemove), so two kids
//     tapping at the same moment can't clobber each other.
//   * The local store (store.js) stays the synchronous model the UI renders.
//     This module writes through to Firestore after each local mutation and
//     feeds remote changes back via onSnapshot. Firestore queues writes while
//     offline and syncs when coverage returns (plus IndexedDB persistence,
//     so dead zones keep working).
//   * Per-device preferences (region, viewer, color mode, active trip, and
//     "this device is") stay in localStorage only — they never sync.
//   * First launch ever: this device's local trips merge into Firestore,
//     matched by trip name and member name, so today's drive isn't lost and
//     nothing duplicates. Later launches just heal anything missing.
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
const TRIPS = 'trips';
const MERGE_KEY = 'mapgame.firebaseMerged';

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
      db = fs.getFirestore(app); // e.g. already initialized — fall back to memory cache
    }
    const F = {
      collection: fs.collection, doc: fs.doc, setDoc: fs.setDoc,
      getDocs: fs.getDocs, updateDoc: fs.updateDoc, deleteDoc: fs.deleteDoc,
      onSnapshot: fs.onSnapshot, arrayUnion: fs.arrayUnion, arrayRemove: fs.arrayRemove,
      runTransaction: (fn) => fs.runTransaction(db, fn),
    };

    store.attachRemote(makeAdapter(db, F));

    // Upload anything local that's missing remotely (first run matches by
    // name so the family's existing trips merge instead of duplicating).
    const firstRun = !safeGet(storage, MERGE_KEY);
    const snap = await F.getDocs(F.collection(db, TRIPS));
    await syncLocalToRemote(db, F, snap, store, firstRun);
    safeSet(storage, MERGE_KEY, '1');

    F.onSnapshot(F.collection(db, TRIPS),
      (s) => {
        const trips = [];
        s.forEach((d) => trips.push(deserializeTrip(d.id, d.data())));
        store.ingestRemoteTrips(trips);
      },
      (err) => console.warn('[firebase] live sync error', err));

    started = true;
    console.log('[firebase] multiplayer live');
  } catch (e) {
    // Offline, bad config, or (most likely before rules are published)
    // permission-denied: stay in local mode; a later 'online' event retries.
    console.warn('[firebase] unavailable — local mode for now', e);
  }
}

function safeGet(storage, k) { try { return storage.getItem(k); } catch (e) { return null; } }
function safeSet(storage, k, v) { try { storage.setItem(k, v); } catch (e) {} }

// ---------------------------------------------------------------------------
// Pure helpers (no Firestore dependency — unit-testable in Node)
// ---------------------------------------------------------------------------

export function normName(n) { return (n || '').trim().toLowerCase(); }

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
//   { create: docData }                      — no remote match, upload as-is
//   { idMap, membersToAdd, spotUnions }       — merge into the remote doc,
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

function makeAdapter(db, F) {
  const ref = (tripId) => F.doc(db, TRIPS, tripId);
  const spotsPath = (region, code) => (region === 'EU' ? 'spots_EU' : `spots_${region}.${code}`);
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
    pushAddSpot(tripId, region, code, spot) {
      return F.updateDoc(ref(tripId), { [spotsPath(region, code)]: F.arrayUnion(spot) });
    },
    pushRemoveSpot(tripId, region, code, spot) {
      return F.updateDoc(ref(tripId), { [spotsPath(region, code)]: F.arrayRemove(spot) });
    },
  };
}

// One-time (and self-healing) upload of local trips. Idempotent: re-running it
// never duplicates anything, so it's safe to run on every launch.
async function syncLocalToRemote(db, F, snap, store, matchNames) {
  const remoteById = new Map();
  const remoteByName = new Map();
  snap.forEach((d) => {
    remoteById.set(d.id, d.data());
    if (matchNames) remoteByName.set(normName(d.data().name), d.id);
  });
  const mergedRemoteIds = new Set();
  for (const t of [...store.state.trips]) {
    if (remoteById.has(t.id)) { await healTrip(db, F, t, remoteById.get(t.id)); continue; }
    if (!tripHasData(t)) continue;
    let remoteId = null;
    if (matchNames) {
      const mid = remoteByName.get(normName(t.name));
      if (mid && !mergedRemoteIds.has(mid)) remoteId = mid;
    }
    if (remoteId) {
      const plan = planMerge(t, remoteById.get(remoteId));
      store.remapTripMembers(t.id, plan.idMap); // local "Dad" becomes remote "Dad"
      const ref = F.doc(db, TRIPS, remoteId);
      if (plan.membersToAdd.length) await F.updateDoc(ref, { members: F.arrayUnion(...plan.membersToAdd) });
      for (const u of plan.spotUnions) await F.updateDoc(ref, { [u.path]: F.arrayUnion(...u.spots) });
      store.adoptTripId(t.id, remoteId);
      mergedRemoteIds.add(remoteId);
    } else {
      await F.setDoc(F.doc(db, TRIPS, t.id), serializeTrip(t));
      remoteById.set(t.id, serializeTrip(t));
    }
  }
}

// Fill gaps from writes that failed earlier (e.g. before rules were live).
// Union-only: never deletes, so it can't clobber anyone.
async function healTrip(db, F, t, remoteData) {
  const ref = F.doc(db, TRIPS, t.id);
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
