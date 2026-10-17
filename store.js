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
    viewer: 'group',     // 'group' | memberId
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

    // ---- preferences (top bar) ----
    setRegion(r)   { if (REGIONS[r] && state.region !== r)   { state.region = r; save(); } },
    setViewer(v)   { if (state.viewer !== v)   { state.viewer = v; save(); } },
    setColorMode(m){ if ((m === 'combined' || m === 'individual') && state.colorMode !== m) { state.colorMode = m; save(); } },

    // ---- trips ----
    addTrip(name) {
      const t = blankTrip((name || 'Road Trip').trim() || 'Road Trip');
      // a new trip starts with the same family members (no re-typing names)
      t.members = trip().members.map((m) => ({ ...m, id: newId('m') }));
      state.trips.push(t);
      state.activeTripId = t.id;
      save();
      return t;
    },
    renameTrip(id, name) {
      const t = state.trips.find((t) => t.id === id);
      name = (name || '').trim();
      if (t && name) { t.name = name; save(); }
    },
    deleteTrip(id) {
      if (state.trips.length <= 1) return false; // always keep at least one trip
      state.trips = state.trips.filter((t) => t.id !== id);
      if (state.activeTripId === id) state.activeTripId = state.trips[0].id;
      save();
      return true;
    },
    setActiveTrip(id) {
      if (state.trips.some((t) => t.id === id) && state.activeTripId !== id) {
        state.activeTripId = id;
        // viewer may point at a member that doesn't exist on this trip
        if (state.viewer !== 'group' && !trip().members.some((m) => m.id === state.viewer)) state.viewer = 'group';
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
      trip().members.push(m);
      // first member added on this device automatically claims it
      if (!trip().deviceMemberId) trip().deviceMemberId = m.id;
      save();
      return m;
    },
    removeMember(id) {
      const t = trip();
      t.members = t.members.filter((m) => m.id !== id);
      if (t.deviceMemberId === id) t.deviceMemberId = t.members[0] ? t.members[0].id : null;
      if (state.viewer === id) state.viewer = 'group';
      save(); // their old spots stay on the map, shown in gray
    },
    setMemberColor(id, color) {
      const m = trip().members.find((m) => m.id === id);
      if (m && color) { m.color = color; save(); }
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
      if (region === 'EU') {
        t.spots.EU.push({ memberId, at });
        save();
        return true;
      }
      const bucket = t.spots[region];
      if (!bucket) return false;
      bucket[code] = bucket[code] || [];
      if (bucket[code].some((s) => s.memberId === memberId)) return false;
      bucket[code].push({ memberId, at });
      save();
      return true;
    },
    // Removes ONE member's mark (used by double-tap undo).
    removeSpot(region, code, memberId) {
      const t = trip();
      if (region === 'EU') {
        // undo = remove this member's most recent EU spot
        for (let i = t.spots.EU.length - 1; i >= 0; i--) {
          if (t.spots.EU[i].memberId === memberId) { t.spots.EU.splice(i, 1); save(); return true; }
        }
        return false;
      }
      const arr = (t.spots[region] || {})[code];
      if (!arr) return false;
      const i = arr.findIndex((s) => s.memberId === memberId);
      if (i === -1) return false;
      arr.splice(i, 1);
      save();
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
    // viewer: 'group' shows the union of everyone's spots; a memberId shows just theirs.
    _visibleSpotters(region, code) {
      const all = store.spottersFor(region, code);
      if (state.viewer === 'group') return all;
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
