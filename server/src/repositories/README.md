# repositories/

Unica capa que habla con Supabase (supabase-js con service role).
Cada repository expone funciones tipadas (`findAll`, `findById`, `create`, ...)
y nunca arma SQL concatenando input del usuario. Los services dependen de
los repositories; los controllers nunca los llaman directamente.

Se completa a partir de la Fase 1.
