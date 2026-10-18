// store.js — MapGame data layer.
//
// Right now this saves everything to localStorage on the device, so the app
// works fully offline with zero setup.
//
// FIREBASE SEAM (for later): when Jonathan creates the Firebase project, add a
// FirestoreStore object that exposes THE SAME method names as the store built
// here (addTrip, addMember, addSpot, removeSpot, onChange, ...). Then app.js
// can swap `createLocalStore()` for the Firestore version without any other
// changes. Firestore's offline persistence + a "spots" subcollection of
// {region, code, memberId, at} documents will merge naturally across devices.

export const STORAGE_KEY = 'mapgame.v1';

// Kid-friendly member colors. A new member gets the first color nobody uses yet.
export const PALETTE = [
  '#e74c3c', // red
  '#f39c12', // orange
  '#f1c40f', // yellow
  '#2ecc71', // green
  '#1abc9c', // teal
  '#3498db', // blue
  '#9b59b6', // purple
  '#fd79a8', // pink
];

// The one accent color used in "Combined" view: every spotted state gets this.
export const COMBINED_COLOR = '#2f80ed';

export const REGIONS = {
  US: { label: 'US', unit: 'states', total: 50 },
  CA: { label: 'Canada', unit: 'provinces', total: 13 },
  EU: { label: 'Europe', unit: 'plates', total: null },
};

function newId(prefix) {
  return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function blankTrip(name) {
  return {
    id: newId('t'),
    name,
    createdAt: Date.now(),
    members: [],          // [{ id, name, color }]
    deviceMemberId: null, // which member is using THIS device (device-local, not synced)
    spots: { US: {}, CA: {}, EU: [] },
    // spots.US / spots.CA: { "CA": [ {memberId, at}, ... ], ... }
    // spots.EU:            [ {memberId, at}, ... ]  (Europe is one bucket, no per-country map)
  };
}

function blankState() {
  const trip = blankTrip('Road Trip 1');
  return {
    version: 1,
    activeTripId: trip.id,
    region: 'US',        // 'US' | 'CA' | 'EU'
    viewer: null,        // individual: memberId (player picker); combined: 'oneColor' | 'byPerson'
    colorMode: 'individual', // 'combined' | 'individual'
    trips: [trip],
  };
}

// storage must look like localStorage: { getItem(k), setItem(k, v) }.
// Passing it in (instead of touching window.localStorage directly) is what
// makes this file testable in Node.
export function createStore(storage) {
  const listeners = new Set();
  let state;
  // Firestore adapter (attached by firebase.js once signed in). Null =
  // local-only mode; every push() below becomes a no-op.
  let remote = null;

  // Fire-and-forget write-through: local state is already updated, this just
  // mirrors it to Firestore. Firestore queues while offline. A failed write
  // is healed by the next launch's sync pass, so nothing is lost silently.
  function push(fn) {
    if (!remote) return;
    try {
      const r = fn(remote);
      if (r && typeof r.catch === 'function') r.catch((e) => console.warn('[sync] write failed', e));
    } catch (e) { console.warn('[sync] write failed', e); }
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    state = raw ? JSON.parse(raw) : blankState();
    if (!state.trips || !state.trips.length) state = blankState();
    // v2 migration: Individual is now the default (and leftmost) color mode.
    if (!state.version || state.version < 2) {
      state.colorMode = 'individual';
      state.version = 2;
      save();
    }
    // v3 migration: the viewer dropdown changed jobs — Individual picks a
    // player, Combined picks one-color vs by-person. Repair any stale value.
    if (!state.version || state.version < 3) {
      state.version = 3;
      fixViewer();
      save();
    }
  } catch (e) {
    state = blankState(); // corrupt save? start fresh rather than crash
  }

  function save() {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked: keep going in memory */ }
    listeners.forEach((cb) => { try { cb(); } catch (e) { /* never let a listener break saving */ } });
  }

  function trip() {
    return state.trips.find((t) => t.id === state.activeTripId) || state.trips[0];
  }

  // The viewer dropdown means something different per color mode, so keep it
  // valid: Individual needs a real player, Combined needs 'oneColor'/'byPerson'.
  function fixViewer() {
    const t = trip();
    if (state.colorMode === 'individual') {
      if (!t.members.some((m) => m.id === state.viewer)) {
        state.viewer = (t.deviceMemberId && t.members.some((m) => m.id === t.deviceMemberId))
          ? t.deviceMemberId
          : (t.members[0] ? t.members[0].id : null);
      }
    } else if (state.viewer !== 'oneColor' && state.viewer !== 'byPerson') {
      state.viewer = 'oneColor';
    }
  }

  function memberName(id) {
    const m = trip().members.find((m) => m.id === id);
    return m ? m.name : 'Someone';
  }

  function memberColor(id) {
    const m = trip().members.find((m) => m.id === id);
    return m ? m.color : '#9aa0a6'; // gray for members that were removed later
  }

  const store = {
    // read-only snapshot for rendering
    get state() { return state; },
    get trip() { return trip(); },
    memberName,
    memberColor,

    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },

    // ---- multiplayer sync ----
    // Called once by firebase.js after anonymous sign-in.
    attachRemote(r) { remote = r; },
    // Replace local trips with the shared remote state. Per-device prefs
    // (deviceMemberId, active trip, viewer, color mode, region) stay local.
    ingestRemoteTrips(remoteTrips) {
      const localById = new Map(state.trips.map((t) => [t.id, t]));
      state.trips = remoteTrips.map((rt) => ({
        ...rt,
        deviceMemberId: localById.get(rt.id) ? localById.get(rt.id).deviceMemberId : null,
      }));
      if (!state.trips.length) state.trips = [blankTrip('Road Trip 1')];
      if (!state.trips.some((t) => t.id === state.activeTripId)) state.activeTripId = state.trips[0].id;
      fixViewer();
      save();
    },
    // After a name-match merge, the local trip adopts the remote doc's id.
    adoptTripId(oldId, newId) {
      const t = state.trips.find((x) => x.id === oldId);
      if (!t) return;
      t.id = newId;
      if (state.activeTripId === oldId) state.activeTripId = newId;
      save();
    },
    // After a name-match merge, local member ids are rewritten to the remote
    // ones ("Dad" on this phone becomes the shared "Dad").
    remapTripMembers(tripId, idMap) {
      const t = state.trips.find((x) => x.id === tripId);
      if (!t) return;
      const map = (id) => idMap[id] || id;
      t.members.forEach((m) => { m.id = map(m.id); });
      if (t.deviceMemberId) t.deviceMemberId = map(t.deviceMemberId);
      for (const region of ['US', 'CA']) {
        const b = t.spots[region] || {};
        for (const code of Object.keys(b)) b[code].forEach((s) => { s.memberId = map(s.memberId); });
      }
      (t.spots.EU || []).forEach((s) => { s.memberId = map(s.memberId); });
      if (state.viewer && idMap[state.viewer]) state.viewer = idMap[state.viewer];
      save();
    },

    // ---- preferences (top bar) ----
    setRegion(r)   { if (REGIONS[r] && state.region !== r)   { state.region = r; save(); } },
    setViewer(v) {
      // Individual: v must be a real player. Combined: 'oneColor' | 'byPerson'.
      if (state.colorMode === 'individual') {
        if (!trip().members.some((m) => m.id === v)) return;
      } else if (v !== 'oneColor' && v !== 'byPerson') {
        return;
      }
      if (state.viewer !== v) { state.viewer = v; save(); }
    },
    setColorMode(m){
      if ((m === 'combined' || m === 'individual') && state.colorMode !== m) {
        state.colorMode = m;
        state.viewer = null; // force fixViewer to pick the right default
        fixViewer();
        save();
      }
    },

    // ---- trips ----
    addTrip(name) {
      const t = blankTrip((name || 'Road Trip').trim() || 'Road Trip');
      // a new trip starts with the same family members (no re-typing names)
      t.members = trip().members.map((m) => ({ ...m, id: newId('m') }));
      state.trips.push(t);
      state.activeTripId = t.id;
      save();
      push((r) => r.pushAddTrip(t));
      return t;
    },
    renameTrip(id, name) {
      const t = state.trips.find((t) => t.id === id);
      name = (name || '').trim();
      if (t && name) { t.name = name; save(); push((r) => r.pushRenameTrip(id, name)); }
    },
    deleteTrip(id) {
      if (state.trips.length <= 1) return false; // always keep at least one trip
      state.trips = state.trips.filter((t) => t.id !== id);
      if (state.activeTripId === id) state.activeTripId = state.trips[0].id;
      save();
      push((r) => r.pushDeleteTrip(id));
      return true;
    },
    setActiveTrip(id) {
      if (state.trips.some((t) => t.id === id) && state.activeTripId !== id) {
        state.activeTripId = id;
        fixViewer(); // the new trip has different players
        save();
      }
    },

    // ---- members ----
    nextFreeColor() {
      const used = new Set(trip().members.map((m) => m.color));
      return PALETTE.find((c) => !used.has(c)) || PALETTE[trip().members.length % PALETTE.length];
    },
    addMember(name, color) {
      name = (name || '').trim();
      if (!name) return null;
      const m = { id: newId('m'), name, color: color || store.nextFreeColor() };
      const t = trip();
      t.members.push(m);
      // first member added on this device automatically claims it
      if (!t.deviceMemberId) t.deviceMemberId = m.id;
      fixViewer(); // e.g. first player becomes the viewed one
      save();
      push((r) => r.pushAddMember(t.id, m));
      return m;
    },
    removeMember(id) {
      const t = trip();
      t.members = t.members.filter((m) => m.id !== id);
      if (t.deviceMemberId === id) t.deviceMemberId = t.members[0] ? t.members[0].id : null;
      fixViewer(); // the viewed player may be gone
      save(); // their old spots stay on the map, shown in gray
      push((r) => r.pushRemoveMember(t.id, id));
    },
    setMemberColor(id, color) {
      const t = trip();
      const m = t.members.find((m) => m.id === id);
      if (m && color) { m.color = color; save(); push((r) => r.pushSetMemberColor(t.id, id, color)); }
    },
    setDeviceMember(id) {
      if (trip().members.some((m) => m.id === id) && trip().deviceMemberId !== id) {
        trip().deviceMemberId = id;
        save();
      }
    },

    // ---- spots ----
    // region: 'US' | 'CA' | 'EU'. code: 'CA' / 'ON' / null (EU has no codes).
    // Returns true when a new spot was recorded, false when that member
    // already had this one marked.
    addSpot(region, code, memberId) {
      const t = trip();
      if (!t.members.some((m) => m.id === memberId)) return false;
      const at = Date.now();
      // NOTE: device clock, not a server timestamp — close enough for a family
      // game, and it keeps local and remote spot objects identical (which is
      // what makes arrayUnion dedup and arrayRemove exact-match work).
      const spot = { memberId, at };
      if (region === 'EU') {
        t.spots.EU.push(spot);
        save();
        push((r) => r.pushAddSpot(t.id, region, code, spot));
        return true;
      }
      const bucket = t.spots[region];
      if (!bucket) return false;
      bucket[code] = bucket[code] || [];
      if (bucket[code].some((s) => s.memberId === memberId)) return false;
      bucket[code].push(spot);
      save();
      push((r) => r.pushAddSpot(t.id, region, code, spot));
      return true;
    },
    // Removes ONE member's mark (used by double-tap undo).
    removeSpot(region, code, memberId) {
      const t = trip();
      if (region === 'EU') {
        // undo = remove this member's most recent EU spot
        for (let i = t.spots.EU.length - 1; i >= 0; i--) {
          if (t.spots.EU[i].memberId === memberId) {
            const [gone] = t.spots.EU.splice(i, 1);
            save();
            push((r) => r.pushRemoveSpot(t.id, region, code, gone));
            return true;
          }
        }
        return false;
      }
      const arr = (t.spots[region] || {})[code];
      if (!arr) return false;
      const i = arr.findIndex((s) => s.memberId === memberId);
      if (i === -1) return false;
      const [gone] = arr.splice(i, 1);
      save();
      push((r) => r.pushRemoveSpot(t.id, region, code, gone));
      return true;
    },
    // Who spotted this region code (before any viewer filtering)?
    spottersFor(region, code) {
      const t = trip();
      if (region === 'EU') return t.spots.EU.slice();
      return ((t.spots[region] || {})[code] || []).slice();
    },
    hasSpot(region, code, memberId) {
      return store.spottersFor(region, code).some((s) => s.memberId === memberId);
    },

    // ---- counts (honor the viewer dropdown) ----
    // Combined (oneColor or byPerson) shows the union of everyone's spots;
    // Individual filters to the picked player.
    _visibleSpotters(region, code) {
      const all = store.spottersFor(region, code);
      if (state.colorMode === 'combined') return all;
      return all.filter((s) => s.memberId === state.viewer);
    },
    countSpotted(region, codes) {
      if (region === 'EU') return store._visibleSpotters('EU').length;
      return codes.filter((c) => store._visibleSpotters(region, c).length > 0).length;
    },
    missingCodes(region, codes) {
      if (region === 'EU') return [];
      return codes.filter((c) => store._visibleSpotters(region, c).length === 0);
    },
  };

  return store;
}
