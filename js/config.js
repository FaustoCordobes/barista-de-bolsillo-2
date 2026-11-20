/* =====================================================================
 * Barista de Bolsillo — CONFIGURACIÓN DE LA NUBE (Supabase)
 * ---------------------------------------------------------------------
 * Completá estos dos valores con los de tu proyecto de Supabase
 * (Project Settings → API). La "anon / publishable key" es PÚBLICA:
 * está pensada para ir en el navegador; la seguridad la dan las
 * reglas RLS de supabase/schema.sql. NUNCA pongas acá la service_role.
 *
 * Si quedan vacíos, la app funciona igual que siempre, sin cuentas.
 * ===================================================================== */
const BDB_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  // Dirección pública de la app (para los mails de confirmación y de recuperar contraseña)
  siteUrl: 'https://barista-de-bolsillo.vercel.app'
};
