// src/lib/accessCodes.js
import supabase from './supabase';

export async function generateAccessCode(eventId, validFrom, validUntil) {
  const code = crypto.randomUUID();
  const result = await supabase
    .from('event_access_codes')
    .insert({ event_id: eventId, code, valid_from: validFrom, valid_until: validUntil })
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  return code;
}

export async function getValidAccessCode(code) {
  const now = new Date().toISOString();
  const result = await supabase
    .from('event_access_codes')
    .select('event_id, valid_until')
    .eq('code', code)
    .lte('valid_from', now)
    .gte('valid_until', now)
    .maybeSingle();
  if (!result.data) return null;
  return { eventId: result.data.event_id, validUntil: result.data.valid_until };
}

export async function listAccessCodesForEvent(eventId) {
  const result = await supabase
    .from('event_access_codes')
    .select('*')
    .eq('event_id', eventId)
    .order('valid_from', { ascending: false });
  if (result.error) throw new Error(result.error.message);
  return result.data.map((row) => ({
    id: row.id,
    code: row.code,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
  }));
}

export async function deleteAccessCode(id) {
  const result = await supabase.from('event_access_codes').delete().eq('id', id);
  if (result.error) throw new Error(result.error.message);
}
