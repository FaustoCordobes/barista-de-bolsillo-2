// Prueba las reglas de seguridad sobre Postgres local. Uso: npm i @electric-sql/pglite && node supabase/rls.test.mjs
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
const db = new PGlite();
const ok = []; const bad = [];
const t = (n, c, x) => (c ? ok : bad).push(n + (c ? '' : '  → ' + (x || '')));
// --- Simulación mínima de Supabase: roles + esquema auth ---
await db.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`);
await db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values
  ('${A}', 'a@x.com', '{"username":"fausto"}'),
  ('${B}', 'b@x.com', '{"username":"fausto"}'),
  ('${C}', 'c@x.com', '{"username":"no valido!"}')`);
const prof = (await db.query('select id, username from public.profiles order by id')).rows;
t('Trigger crea perfiles para los 3', prof.length === 3);
t('Nombre repetido o inválido → perfil sin nombre', prof[1].username === null && prof[2].username === null && prof[0].username === 'fausto', JSON.stringify(prof));
const as = async (uid, sql, params) => {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid || ''}', false); set role ${uid ? 'authenticated' : 'anon'};`);
  try { return { rows: (await db.query(sql, params)).rows }; } catch (e) { return { error: e.message }; } finally { await db.exec('reset role'); }
};
// user_items
let r = await as(A, `insert into public.user_items (kind, client_id, data) values ('recipe', 1, '{"brewer":"v60"}') returning user_id`);
t('A guarda una receta (user_id automático)', r.rows && r.rows[0].user_id === A, r.error);
r = await as(B, `select * from public.user_items`);
t('B NO ve los datos de A', r.rows && r.rows.length === 0, JSON.stringify(r));
r = await as(B, `insert into public.user_items (user_id, kind, client_id, data) values ('${A}', 'recipe', 2, '{}')`);
t('B NO puede escribir a nombre de A', !!r.error);
r = await as(null, `select * from public.user_items`);
t('Anónimo NO ve datos privados', !r.rows || r.rows.length === 0, JSON.stringify(r));
r = await as(A, `insert into public.user_items (kind, client_id, data) values ('hack', 3, '{}')`);
t('Tipo inválido rechazado', !!r.error);
r = await as(A, `update public.user_items set data = '{"brewer":"chemex"}', updated_at = now() where client_id = 1 returning data`);
t('A edita su receta', r.rows && r.rows[0].data.brewer === 'chemex', r.error);
// public_recipes
r = await as(A, `insert into public.public_recipes (client_id, title, brewer, data) values (1, 'Mi V60', 'v60', '{"brewer":"v60"}') returning id, likes_count`);
const pid = r.rows && r.rows[0].id;
t('A publica una receta', !!pid && r.rows[0].likes_count === 0, r.error);
r = await as(null, `select r.title, p.username from public.public_recipes r join public.profiles p on p.id = r.user_id`);
t('Anónimo ve recetas públicas con autor', r.rows && r.rows[0].title === 'Mi V60' && r.rows[0].username === 'fausto', JSON.stringify(r));
r = await as(A, `update public.public_recipes set likes_count = 999 where id = '${pid}'`);
t('Nadie puede inflar los me gusta a mano', !!r.error, JSON.stringify(r));
r = await as(B, `update public.public_recipes set title = 'robada' where id = '${pid}' returning id`);
t('B NO edita la receta de A', !r.rows || r.rows.length === 0, JSON.stringify(r));
r = await as(B, `delete from public.public_recipes where id = '${pid}' returning id`);
t('B NO borra la receta de A', !r.rows || r.rows.length === 0);
r = await as(null, `insert into public.public_recipes (user_id, client_id, title, brewer, data) values ('${A}', 9, 'x', 'v60', '{}')`);
t('Anónimo NO publica', !!r.error);
// likes
r = await as(B, `insert into public.recipe_likes (recipe_id) values ('${pid}')`);
t('B da me gusta', !r.error, r.error);
r = await as(C, `insert into public.recipe_likes (recipe_id) values ('${pid}')`);
r = await as(null, `select likes_count from public.public_recipes where id = '${pid}'`);
t('Contador de me gusta = 2 (trigger)', r.rows && r.rows[0].likes_count === 2, JSON.stringify(r));
r = await as(B, `insert into public.recipe_likes (recipe_id) values ('${pid}')`);
t('No se puede dar me gusta dos veces', !!r.error);
r = await as(A, `select * from public.recipe_likes`);
t('A no ve los me gusta de otros', r.rows && r.rows.length === 0);
r = await as(B, `delete from public.recipe_likes where recipe_id = '${pid}'`);
r = await as(null, `select likes_count from public.public_recipes where id = '${pid}'`);
t('Sacar me gusta descuenta (1)', r.rows && r.rows[0].likes_count === 1);
// perfil
r = await as(B, `update public.profiles set username = 'barista_b' where id = '${B}' returning username`);
t('B elige su nombre de usuario', r.rows && r.rows[0].username === 'barista_b', r.error);
r = await as(B, `update public.profiles set username = 'pirata' where id = '${A}' returning username`);
t('B NO cambia el nombre de A', !r.rows || r.rows.length === 0);
// eliminar cuenta
r = await as(null, `select public.delete_my_account()`);
t('Anónimo no puede borrar cuentas', !!r.error);
r = await as(A, `select public.delete_my_account()`);
t('A elimina su cuenta', !r.error, r.error);
const left = (await db.query(`select (select count(*) from auth.users where id='${A}') u, (select count(*) from public.user_items where user_id='${A}') i, (select count(*) from public.public_recipes) p, (select count(*) from public.recipe_likes) l, (select count(*) from public.profiles where id='${A}') pr`)).rows[0];
t('Borrado en cascada: usuario, datos, recetas públicas, me gusta y perfil', Object.values(left).every(v => Number(v) === 0), JSON.stringify(left));
console.log(ok.map(x => '  ✓ ' + x).join('\n'));
if (bad.length) console.log(bad.map(x => '  ✗ ' + x).join('\n'));
console.log(`\n${ok.length}/${ok.length + bad.length} OK`);
