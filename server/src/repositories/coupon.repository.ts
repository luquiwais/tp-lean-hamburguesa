import { supabase } from '../lib/supabase';

export interface CouponRow {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_total: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
}

export const couponRepository = {
  async findByCode(code: string): Promise<CouponRow | null> {
    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, type, value, min_total, max_uses, used_count, expires_at, is_active')
      .eq('code', code)
      .maybeSingle<CouponRow>();
    if (error) throw error;
    return data;
  },
};
