import { useLocation, useNavigate } from 'react-router';

// El personalizador y el carrito son rutas: cerrarlos = volver atrás, así el
// botón "atrás" del navegador también los cierra. Si se entró directo por
// URL no hay historial propio y se vuelve al menú.
export function useCloseOverlay() {
  const navigate = useNavigate();
  const { key } = useLocation();
  return () => (key === 'default' ? navigate('/', { replace: true }) : navigate(-1));
}
