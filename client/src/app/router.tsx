import { createBrowserRouter, Navigate } from 'react-router';
import { MenuPage } from '@/features/menu/MenuPage';
import { ProductCustomizer } from '@/features/product-customizer/ProductCustomizer';
import { CartSheet } from '@/features/cart/CartSheet';

// El personalizador y el carrito son hijas del menú: se abren encima (modal /
// drawer), tienen URL propia y el "atrás" del navegador los cierra.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <MenuPage />,
    children: [
      { path: 'menu/:slug', element: <ProductCustomizer /> },
      { path: 'carrito', element: <CartSheet /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
