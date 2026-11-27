// PostgreSQL en memoria: no usa Supabase, Auth real ni credenciales.
// npm install --prefix <temporal> --no-save --no-package-lock @electric-sql/pglite@0.5.17
// NODE_PATH="<temporal>/node_modules" node --test tests/fixtureAdminCentralActivo.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');

test('0003220: protege al admin central activo sin cambiar la unicidad', async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  const migracion = await readFile(new URL(
    '../supabase/migrations/00000000000054_proteger_admin_central_activo.sql', import.meta.url,
  ), 'utf8');

  await db.exec(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id integer PRIMARY KEY);
    CREATE TYPE public.rol_usuario AS ENUM ('admin_central', 'operador_drogueria', 'visor_botica');
    CREATE TABLE public.usuarios (
      id integer PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      org_id integer NOT NULL, rol public.rol_usuario NOT NULL,
      activo boolean NOT NULL, nombre text NOT NULL
    );
    CREATE UNIQUE INDEX idx_usuarios_unico_admin_central_org
      ON public.usuarios(org_id) WHERE rol = 'admin_central';
    INSERT INTO auth.users VALUES (1), (2), (3), (4), (5);
    INSERT INTO public.usuarios VALUES (1, 10, 'admin_central', true, 'Inicial'),
      (2, 20, 'admin_central', false, 'Inactivo'), (3, 10, 'visor_botica', true, 'Visor'),
      (4, 30, 'admin_central', false, 'Otro inactivo');
  `);
  await db.exec(migracion);
  await db.exec(migracion);

  for (const [caso, sql] of [
    ['desactivar', 'UPDATE usuarios SET activo = false WHERE id = 1'],
    ['degradar', "UPDATE usuarios SET rol = 'operador_drogueria' WHERE id = 1"],
    ['mover a una org sin admin', 'UPDATE usuarios SET org_id = 40 WHERE id = 1'],
    ['borrar perfil', 'DELETE FROM usuarios WHERE id = 1'],
    ['borrar desde Auth por cascada', 'DELETE FROM auth.users WHERE id = 1'],
  ]) {
    await t.test(caso, () => assert.rejects(db.exec(sql), { code: 'PT409' }));
  }

  await t.test('mantiene la unicidad incluso para un admin inactivo', () => assert.rejects(
    db.exec("INSERT INTO usuarios VALUES (5, 20, 'admin_central', true, 'Duplicado')"),
    { code: '23505' },
  ));

  await t.test('permite cambios inocuos, reactivacion y cascadas no protegidas', async () => {
    await db.exec(`
      UPDATE usuarios SET nombre = 'Editado', activo = true, org_id = 10, rol = 'admin_central' WHERE id = 1;
      UPDATE usuarios SET activo = true WHERE id = 2;
      DELETE FROM auth.users WHERE id IN (3, 4);
    `);
    assert.deepEqual((await db.query('SELECT id, org_id, rol, activo, nombre FROM usuarios ORDER BY id')).rows, [
      { id: 1, org_id: 10, rol: 'admin_central', activo: true, nombre: 'Editado' },
      { id: 2, org_id: 20, rol: 'admin_central', activo: true, nombre: 'Inactivo' },
    ]);
    assert.deepEqual((await db.query('SELECT id FROM auth.users ORDER BY id')).rows, [{ id: 1 }, { id: 2 }, { id: 5 }]);
  });
});
