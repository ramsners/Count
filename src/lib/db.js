import { openDB } from 'idb';

const DB_NAME = 'festwerk-stand';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Produktpalette (global, wird pro Event nur ausgewählt)
      if (!db.objectStoreNames.contains('products')) {
        const store = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name');
      }
      // Veranstaltungen
      if (!db.objectStoreNames.contains('events')) {
        db.createObjectStore('events', { keyPath: 'id', autoIncrement: true });
      }
      // Kühlgeräte (gehören zu einem Event)
      if (!db.objectStoreNames.contains('fridges')) {
        const store = db.createObjectStore('fridges', { keyPath: 'id', autoIncrement: true });
        store.createIndex('eventId', 'eventId');
      }
      // Zähl-Sessions (ein Zählvorgang für ein Kühlgerät zu einem Zeitpunkt)
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        store.createIndex('fridgeId', 'fridgeId');
        store.createIndex('eventId', 'eventId');
      }
    },
  });
}

// ---------- Products ----------
export async function addProduct(product) {
  const db = await getDB();
  // product: { name, gebinde: [{label, units}] }
  return db.add('products', product);
}

export async function updateProduct(product) {
  const db = await getDB();
  return db.put('products', product);
}

export async function deleteProduct(id) {
  const db = await getDB();
  return db.delete('products', id);
}

export async function getAllProducts() {
  const db = await getDB();
  return db.getAll('products');
}

// ---------- Events ----------
export async function addEvent(event) {
  const db = await getDB();
  // event: { name, dateStart, dateEnd, productIds: [] }
  return db.add('events', event);
}

export async function updateEvent(event) {
  const db = await getDB();
  return db.put('events', event);
}

export async function getEvent(id) {
  const db = await getDB();
  return db.get('events', id);
}

export async function getAllEvents() {
  const db = await getDB();
  return db.getAll('events');
}

export async function deleteEvent(id) {
  const db = await getDB();
  const tx = db.transaction(['events', 'fridges', 'sessions'], 'readwrite');
  await tx.objectStore('events').delete(id);
  const fridges = await tx.objectStore('fridges').index('eventId').getAll(id);
  for (const f of fridges) {
    await tx.objectStore('fridges').delete(f.id);
    const sessions = await tx.objectStore('sessions').index('fridgeId').getAll(f.id);
    for (const s of sessions) {
      await tx.objectStore('sessions').delete(s.id);
    }
  }
  await tx.done;
}

// ---------- Fridges ----------
export async function addFridge(fridge) {
  // fridge: { eventId, type: 'Kühlschrank' | 'Kühltruhe', label auto-generated }
  const db = await getDB();
  const existing = await db.getAllFromIndex('fridges', 'eventId', fridge.eventId);
  const prefix = fridge.type === 'Kühltruhe' ? 'T' : 'K';
  const countOfType = existing.filter((f) => f.type === fridge.type).length;
  const label = `${prefix}${countOfType + 1}`;
  return db.add('fridges', { ...fridge, label });
}

export async function getFridgesForEvent(eventId) {
  const db = await getDB();
  return db.getAllFromIndex('fridges', 'eventId', eventId);
}

export async function deleteFridge(id) {
  const db = await getDB();
  const tx = db.transaction(['fridges', 'sessions'], 'readwrite');
  await tx.objectStore('fridges').delete(id);
  const sessions = await tx.objectStore('sessions').index('fridgeId').getAll(id);
  for (const s of sessions) {
    await tx.objectStore('sessions').delete(s.id);
  }
  await tx.done;
}

// ---------- Sessions (Zählvorgänge) ----------
export async function addSession(session) {
  // session: { eventId, fridgeId, timestamp, label ('Anfangsstand'|'Endstand'|...), entries: [{productId, loose, gebindeCounts: {gebindeLabel: n}, total}] }
  const db = await getDB();
  return db.add('sessions', session);
}

export async function getSessionsForFridge(fridgeId) {
  const db = await getDB();
  const sessions = await db.getAllFromIndex('sessions', 'fridgeId', fridgeId);
  return sessions.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getLastSessionForFridge(fridgeId) {
  const sessions = await getSessionsForFridge(fridgeId);
  return sessions.length ? sessions[sessions.length - 1] : null;
}

export async function getSession(id) {
  const db = await getDB();
  return db.get('sessions', id);
}
