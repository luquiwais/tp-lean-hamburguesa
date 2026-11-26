import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

// Cliente unico de Supabase con la secret/service_role key.
// Bypassea RLS: SOLO se usa en el backend y SOLO desde la capa repositories.
// Sin sesion persistida: la auth de usuarios es propia (JWT del backend).
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
