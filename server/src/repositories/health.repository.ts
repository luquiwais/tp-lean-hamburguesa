import { supabase } from '../lib/supabase';

// Chequea que la DB responda con una consulta minima sobre una tabla propia.
export const healthRepository = {
  async pingDatabase(): Promise<boolean> {
    const { error } = await supabase.from('store_settings').select('id').limit(1);
    if (error) throw error;
    return true;
  },
};
