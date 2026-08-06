// src/lib/photos.js
import supabase from './supabase';

export async function uploadSessionPhoto(sessionId, file) {
  const path = `sessions/${sessionId}/${Date.now()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('session-photos')
    .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });
  if (uploadError) throw new Error(uploadError.message);

  const result = await supabase
    .from('session_photos')
    .insert({ session_id: sessionId, storage_path: path })
    .select()
    .single();
  if (result.error) throw new Error(result.error.message);
  return path;
}

export async function getSessionPhotos(sessionId) {
  const result = await supabase
    .from('session_photos')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at');
  if (result.error) throw new Error(result.error.message);
  return Promise.all(
    result.data.map(async (row) => {
      const { data } = supabase.storage
        .from('session-photos')
        .getPublicUrl(row.storage_path);
      return { id: row.id, sessionId: row.session_id, url: data.publicUrl, createdAt: row.created_at };
    })
  );
}

export async function getLastFridgePhoto(fridgeId) {
  // Letzte Session des Kühlgeräts mit Foto holen
  const sessions = await supabase
    .from('sessions')
    .select('id')
    .eq('fridge_id', fridgeId)
    .order('timestamp', { ascending: false });
  if (sessions.error || !sessions.data.length) return null;

  for (const s of sessions.data) {
    const photos = await getSessionPhotos(s.id);
    if (photos.length) return photos[photos.length - 1];
  }
  return null;
}
