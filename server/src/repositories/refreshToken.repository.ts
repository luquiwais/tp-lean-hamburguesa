import { supabase } from '../lib/supabase';

export interface RefreshTokenRow {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
}

const FIELDS = 'id, user_id, family_id, token_hash, expires_at, revoked_at';

export const refreshTokenRepository = {
  async create(input: {
    userId: string;
    familyId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<RefreshTokenRow> {
    const { data, error } = await supabase
      .from('refresh_tokens')
      .insert({
        user_id: input.userId,
        family_id: input.familyId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt.toISOString(),
      })
      .select(FIELDS)
      .single<RefreshTokenRow>();
    if (error) throw error;
    return data;
  },

  async findByHash(tokenHash: string): Promise<RefreshTokenRow | null> {
    const { data, error } = await supabase
      .from('refresh_tokens')
      .select(FIELDS)
      .eq('token_hash', tokenHash)
      .maybeSingle<RefreshTokenRow>();
    if (error) throw error;
    return data;
  },

  // Revoca el token SOLO si sigue activo. Devuelve false si ya estaba
  // revocado (otro request lo roto antes, o es un reuso): permite rotar de
  // forma segura ante requests concurrentes.
  async revokeIfActive(id: string, replacedBy: string | null): Promise<boolean> {
    const { data, error } = await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString(), replaced_by: replacedBy })
      .eq('id', id)
      .is('revoked_at', null)
      .select('id');
    if (error) throw error;
    return data.length > 0;
  },

  // Cierra toda la sesion (todos los tokens descendientes del mismo login).
  async revokeFamily(familyId: string): Promise<void> {
    const { error } = await supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('family_id', familyId)
      .is('revoked_at', null);
    if (error) throw error;
  },
};
