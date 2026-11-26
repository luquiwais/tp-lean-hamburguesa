import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const useCategories = () => useQuery({ queryKey: ['categories'], queryFn: api.categories });
export const useProducts = () => useQuery({ queryKey: ['products'], queryFn: api.products });
export const useStoreSettings = () => useQuery({ queryKey: ['store'], queryFn: api.store });
