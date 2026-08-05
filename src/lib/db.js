import supabase from './supabase';

function throwIfError({ error }, context) {
  if (error) throw new Error(`[db.js] ${context}: ${error.message}`);
}

function mapEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    dateStart: row.date_start,
    dateEnd: row.date_end,
    productIds: row.product_ids ?? [],
    createdAt: row.created_at,
  };
}

function mapFridge(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    type: row.type,
    label: row.label,
    createdAt: row.created_at,
  };
}

function mapSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    fridgeId: row.fridge_id,
    timestamp: row.timestamp,
    label: row.label,
    entries: row.entries ?? [],
  };
}

// ---------- Products ----------
export async function addProduct(product) {
  const result = await supabase
    .from('products')
    .insert({ name: product.name, gebinde: product.gebinde })
    .select()
    .single();
  throwIfError(result, 'addProduct');
  return result.data.id;
}

export async function updateProduct(product) {
  const result = await supabase
    .from('products')
    .update({ name: product.name, gebinde: product.gebinde })
    .eq('id', product.id);
  throwIfError(result, 'updateProduct');
}

export async function deleteProduct(id) {
  const result = await supabase.from('products').delete().eq('id', id);
  throwIfError(result, 'deleteProduct');
}

export async function getAllProducts() {
  const result = await supabase.from('products').select('*').order('name');
  throwIfError(result, 'getAllProducts');
  return result.data;
}

// ---------- Events ----------
export async function addEvent(event) {
  const result = await supabase
    .from('events')
    .insert({
      name: event.name,
      date_start: event.dateStart ?? null,
      date_end: event.dateEnd ?? null,
      product_ids: event.productIds ?? [],
    })
    .select()
    .single();
  throwIfError(result, 'addEvent');
  return result.data.id;
}

export async function updateEvent(event) {
  const result = await supabase
    .from('events')
    .update({
      name: event.name,
      date_start: event.dateStart ?? null,
      date_end: event.dateEnd ?? null,
      product_ids: event.productIds ?? [],
    })
    .eq('id', event.id);
  throwIfError(result, 'updateEvent');
}

export async function getEvent(id) {
  const result = await supabase.from('events').select('*').eq('id', id).single();
  throwIfError(result, 'getEvent');
  return mapEvent(result.data);
}

export async function getAllEvents() {
  const result = await supabase
    .from('events')
    .select('*')
    .order('date_start', { ascending: false });
  throwIfError(result, 'getAllEvents');
  return result.data.map(mapEvent);
}

export async function deleteEvent(id) {
  // Cascade deletes fridges + sessions automatically (FK on delete cascade)
  const result = await supabase.from('events').delete().eq('id', id);
  throwIfError(result, 'deleteEvent');
}

// ---------- Fridges ----------
export async function addFridge(fridge) {
  const existing = await getFridgesForEvent(fridge.eventId);
  const prefix = fridge.type === 'Kühltruhe' ? 'T' : 'K';
  const countOfType = existing.filter((f) => f.type === fridge.type).length;
  const label = `${prefix}${countOfType + 1}`;
  const result = await supabase
    .from('fridges')
    .insert({ event_id: fridge.eventId, type: fridge.type, label })
    .select()
    .single();
  throwIfError(result, 'addFridge');
  return result.data.id;
}

export async function getFridgesForEvent(eventId) {
  const result = await supabase
    .from('fridges')
    .select('*')
    .eq('event_id', eventId)
    .order('label');
  throwIfError(result, 'getFridgesForEvent');
  return result.data.map(mapFridge);
}

export async function deleteFridge(id) {
  // Cascade deletes sessions automatically
  const result = await supabase.from('fridges').delete().eq('id', id);
  throwIfError(result, 'deleteFridge');
}

export async function getFridgeById(id) {
  const result = await supabase.from('fridges').select('*').eq('id', id).single();
  throwIfError(result, 'getFridgeById');
  return mapFridge(result.data);
}

// ---------- Sessions ----------
export async function addSession(session) {
  const result = await supabase
    .from('sessions')
    .insert({
      event_id: session.eventId,
      fridge_id: session.fridgeId,
      timestamp: session.timestamp,
      label: session.label,
      entries: session.entries,
    })
    .select()
    .single();
  throwIfError(result, 'addSession');
  return result.data.id;
}

export async function updateSession(session) {
  const result = await supabase
    .from('sessions')
    .update({ entries: session.entries, label: session.label })
    .eq('id', session.id);
  throwIfError(result, 'updateSession');
}

export async function getSessionsForFridge(fridgeId) {
  const result = await supabase
    .from('sessions')
    .select('*')
    .eq('fridge_id', fridgeId)
    .order('timestamp');
  throwIfError(result, 'getSessionsForFridge');
  return result.data.map(mapSession);
}

export async function getLastSessionForFridge(fridgeId) {
  const sessions = await getSessionsForFridge(fridgeId);
  return sessions.length ? sessions[sessions.length - 1] : null;
}

export async function getLastEndstandForFridge(fridgeId) {
  const result = await supabase
    .from('sessions')
    .select('*')
    .eq('fridge_id', fridgeId)
    .eq('label', 'Endstand')
    .order('timestamp', { ascending: false })
    .limit(1);
  throwIfError(result, 'getLastEndstandForFridge');
  return result.data.length ? mapSession(result.data[0]) : null;
}

export async function getSessionsForFridgeOnDate(fridgeId, dateStr) {
  // dateStr: 'YYYY-MM-DD', filter by unix ms timestamp range
  const from = new Date(dateStr + 'T00:00:00').getTime();
  const to = new Date(dateStr + 'T23:59:59').getTime();
  const result = await supabase
    .from('sessions')
    .select('*')
    .eq('fridge_id', fridgeId)
    .gte('timestamp', from)
    .lte('timestamp', to)
    .order('timestamp');
  throwIfError(result, 'getSessionsForFridgeOnDate');
  return result.data.map(mapSession);
}

export async function getSession(id) {
  const result = await supabase.from('sessions').select('*').eq('id', id).single();
  throwIfError(result, 'getSession');
  return mapSession(result.data);
}
