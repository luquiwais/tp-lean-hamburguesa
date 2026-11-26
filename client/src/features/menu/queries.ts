import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export const menuQuery = { queryKey: ['menu'], queryFn: api.menu };
export const productQuery = (slug: string) => ({
  queryKey: ['product', slug],
  queryFn: () => api.product(slug),
});

export const useMenu = () => useQuery(menuQuery);
export const useProduct = (slug: string) => useQuery(productQuery(slug));
