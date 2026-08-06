// src/lib/locks.js
import supabase from './supabase';

export function getDeviceId() {
  let id = localStorage.getItem('festwerk-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('festwerk-device-id', id);
  }
  return id;
}

export async function lockFridge(fridgeId, eventId, lockedByName) {
  const lockedBy = getDeviceId();

  // Erst prüfen ob bereits ein Lock existiert (behandelt React StrictMode Doppel-Mount)
  const existing = await supabase
    .from('fridge_locks')
    .select('locked_by')
    .eq('fridge_id', fridgeId)
    .maybeSingle();

  if (existing.data) {
    // Lock existiert — gehört er uns?
    return existing.data.locked_by === lockedBy;
  }

  // Kein Lock — jetzt setzen
  const result = await supabase
    .from('fridge_locks')
    .insert({ fridge_id: fridgeId, event_id: eventId, locked_by: lockedBy, locked_by_name: lockedByName })
    .select()
    .single();
  return !result.error;
}

export async function unlockFridge(fridgeId) {
  const lockedBy = getDeviceId();
  await supabase
    .from('fridge_locks')
    .delete()
    .eq('fridge_id', fridgeId)
    .eq('locked_by', lockedBy);
}

export async function unlockFridgeForced(fridgeId) {
  await supabase.from('fridge_locks').delete().eq('fridge_id', fridgeId);
}

export async function getFridgeLock(fridgeId) {
  const result = await supabase
    .from('fridge_locks')
    .select('*')
    .eq('fridge_id', fridgeId)
    .maybeSingle();
  if (result.error || !result.data) return null;
  return {
    fridgeId: result.data.fridge_id,
    lockedBy: result.data.locked_by,
    lockedByName: result.data.locked_by_name,
    lockedAt: result.data.locked_at,
    isOwnLock: result.data.locked_by === getDeviceId(),
  };
}

export function subscribeFridgeLocks(eventId, callback) {
  const sub = supabase
    .channel(`fridge-locks-${eventId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'fridge_locks',
      filter: `event_id=eq.${eventId}`,
    }, () => callback())
    .subscribe();
  return () => supabase.removeChannel(sub);
}
