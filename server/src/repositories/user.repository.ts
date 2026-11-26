import type { Role } from '@burger/shared';
import { supabase } from '../lib/supabase';
import { conflict } from '../lib/errors';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
}

export interface UserWithHashRow extends UserRow {
  password_hash: string;
}

const PUBLIC_FIELDS = 'id, email, name, phone, role';

// Los emails se guardan siempre en minusculas (lo normaliza el schema Zod),
// asi que la busqueda por igualdad usa el indice unico lower(email).
export const userRepository = {
  async findByEmailWithHash(email: string): Promise<UserWithHashRow | null> {
    const { data, error } = await supabase
      .from('users')
      .select(`${PUBLIC_FIELDS}, password_hash`)
      .eq('email', email)
      .maybeSingle<UserWithHashRow>();
    if (error) throw error;
    return data;
  },

  async findById(id: string): Promise<UserRow | null> {
    const { data, error } = await supabase
      .from('users')
      .select(PUBLIC_FIELDS)
      .eq('id', id)
      .maybeSingle<UserRow>();
    if (error) throw error;
    return data;
  },

  async create(input: {
    email: string;
    passwordHash: string;
    name: string;
    phone: string | null;
    role?: Role;
  }): Promise<UserRow> {
    const { data, error } = await supabase
      .from('users')
      .insert({
        email: input.email,
        password_hash: input.passwordHash,
        name: input.name,
        phone: input.phone,
        role: input.role ?? 'customer',
      })
      .select(PUBLIC_FIELDS)
      .single<UserRow>();
    if (error) {
      // 23505 = unique_violation (carrera entre dos registros con el mismo email)
      if (error.code === '23505') throw conflict('Ya existe una cuenta con ese email');
      throw error;
    }
    return data;
  },

  async update(
    id: string,
    fields: Partial<{ password_hash: string; name: string; role: Role }>,
  ): Promise<UserRow> {
    const { data, error } = await supabase
      .from('users')
      .update(fields)
      .eq('id', id)
      .select(PUBLIC_FIELDS)
      .single<UserRow>();
    if (error) throw error;
    return data;
  },
};
