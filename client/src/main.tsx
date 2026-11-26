import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { router } from '@/app/router';
import { ApiError } from '@/lib/api';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Plan: 3 reintentos (300/600/1200 ms + jitter) y nunca reintentar un 4xx.
      retry: (failureCount, error) =>
        failureCount < 3 && !(error instanceof ApiError && error.status < 500),
      retryDelay: (attempt) => 300 * 2 ** attempt + Math.random() * 100,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('No se encontro el elemento #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
