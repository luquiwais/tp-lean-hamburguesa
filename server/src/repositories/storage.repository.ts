import { supabase } from '../lib/supabase';

// Supabase Storage, bucket publico "products" (solo lectura publica; las
// escrituras las hace el backend con la secret key).
const BUCKET = 'products';
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`;

export const storageRepository = {
  async upload(path: string, body: Buffer, contentType: string): Promise<string> {
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType,
      cacheControl: '31536000', // el nombre cambia en cada subida: se puede cachear para siempre
      upsert: false,
    });
    if (error) throw error;
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  },

  // Borra el archivo de una URL publica nuestra. Ignora URLs ajenas.
  async removeByPublicUrl(url: string | null): Promise<void> {
    if (!url) return;
    const index = url.indexOf(PUBLIC_MARKER);
    if (index === -1) return;
    const path = decodeURIComponent(url.slice(index + PUBLIC_MARKER.length));
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  },
};
