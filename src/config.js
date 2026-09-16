/*
 * Ligação ao Supabase. A chave "publishable"/"anon" é pública por natureza:
 * a segurança vem das regras da tabela (cada utilizador só vê os seus dados)
 * e de os registos de novas contas estarem desligados no projeto.
 * Com os campos vazios, a app funciona só no dispositivo.
 */
export const SUPABASE_URL = 'https://xdfhennfwlfzluczwtfi.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_y7sjhyjiMXvaPkiwK4v1oQ_shUCg-Ib';
