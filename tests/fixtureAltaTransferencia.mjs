// Optativo: NODE_PATH="<temporal>/node_modules" node --test tests/fixtureAltaTransferencia.mjs
// PGlite en memoria con esquema reducido; no se conecta a Supabase.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const { PGlite } = createRequire(import.meta.url)('@electric-sql/pglite');
const MIGRACION = await readFile(new URL(
  '../supabase/migrations/00000000000056_alta_transferencia_transaccional.sql', import.meta.url,
), 'utf8');
const [ORG, USUARIO, ORIGEN, DESTINO, PRODUCTO, LOTE, LOTE_INEXISTENTE] =
  Array.from({ length: 7 }, (_, i) => `00000000-0000-4000-8000-00000000000${i + 1}`);
const NUMERO = 'TRF-000001';
const ITEM = { producto_id: PRODUCTO, lote_id: LOTE, cantidad: 3 };

async function prepararBase(t) {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE ROLE solo_public;
    CREATE TYPE public.tipo_transferencia AS ENUM ('transferencia_central', 'redistribucion');
    CREATE TYPE public.tipo_ubicacion AS ENUM ('drogueria', 'botica');
    CREATE TABLE public.lotes (id uuid PRIMARY KEY);
    CREATE TABLE public.transferencias (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id uuid NOT NULL, numero_transferencia text NOT NULL,
      tipo_transferencia public.tipo_transferencia NOT NULL,
      origen_tipo public.tipo_ubicacion NOT NULL, origen_id uuid,
      destino_tipo public.tipo_ubicacion NOT NULL, destino_id uuid NOT NULL,
      estado text NOT NULL, creado_por uuid NOT NULL, observaciones text,
      created_by uuid NOT NULL, modified_by uuid NOT NULL
    );
    CREATE TABLE public.transferencias_items (
      org_id uuid NOT NULL, transferencia_id uuid NOT NULL REFERENCES public.transferencias(id),
      producto_id uuid NOT NULL, lote_id uuid REFERENCES public.lotes(id), cantidad integer NOT NULL,
      created_by uuid NOT NULL, modified_by uuid NOT NULL
    );
    CREATE TABLE public.auditoria (
      org_id uuid NOT NULL, usuario_id uuid, accion text NOT NULL,
      entidad text, entidad_id uuid, nivel text NOT NULL, detalle text
    );
    GRANT SELECT, UPDATE ON public.lotes TO service_role;
    GRANT INSERT ON public.transferencias, public.transferencias_items, public.auditoria TO service_role;
    GRANT SELECT (id) ON public.transferencias TO service_role;
  `);
  // Solo sustituye al numerador anterior; la RPC se carga sin modificaciones.
  await db.exec(`
    CREATE FUNCTION public.generar_numero_transferencia(uuid) RETURNS text
      LANGUAGE sql AS $$ SELECT '${NUMERO}'::text $$;
  `);
  await db.query('INSERT INTO public.lotes (id) VALUES ($1)', [LOTE]);
  await db.exec(MIGRACION);
  return db;
}

async function crearTransferencia(db, tipo = 'transferencia_central', items = [ITEM]) {
  const { rows: [fila] } = await db.query(`
    SELECT public.crear_transferencia(
      $1::uuid, $2::uuid, $3::public.tipo_transferencia, $4::uuid, $5::uuid, $6::text, $7::jsonb
    ) AS resultado
  `, [ORG, USUARIO, tipo, ORIGEN, DESTINO, 'Fixture 56', JSON.stringify(items)]);
  return fila.resultado;
}

async function comprobarSinEscrituras(db) {
  const { rows } = await db.query(`
    SELECT (SELECT count(*)::int FROM public.transferencias) AS cabeceras,
           (SELECT count(*)::int FROM public.transferencias_items) AS items,
           (SELECT count(*)::int FROM public.auditoria) AS auditorias
  `);
  assert.deepEqual(rows, [{ cabeceras: 0, items: 0, auditorias: 0 }]);
}

for (const [tipo, origenTipo, accion, detalle] of [
  ['transferencia_central', 'drogueria', 'CREAR_TRANSFERENCIA',
    `Se cre\u00f3 transferencia a botica ${DESTINO} con 1 producto(s)`],
  ['redistribucion', 'botica', 'CREAR_REDISTRIBUCION',
    `Se cre\u00f3 redistribuci\u00f3n de botica ${ORIGEN} a botica ${DESTINO} con 1 producto(s)`],
]) {
  test(`56: ${tipo} con service_role persiste cabecera, item y auditoria`, async (t) => {
    const db = await prepararBase(t);
    await db.exec('SET ROLE service_role');
    const resultado = await crearTransferencia(db, tipo);
    await db.exec('RESET ROLE');
    assert.match(resultado.id, /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
    assert.deepEqual(resultado, { exito: true, id: resultado.id, numero_transferencia: NUMERO });
    assert.deepEqual((await db.query('SELECT * FROM public.transferencias')).rows, [{
      id: resultado.id, org_id: ORG, numero_transferencia: NUMERO, tipo_transferencia: tipo,
      origen_tipo: origenTipo, origen_id: ORIGEN, destino_tipo: 'botica', destino_id: DESTINO,
      estado: 'creada', creado_por: USUARIO, observaciones: 'Fixture 56',
      created_by: USUARIO, modified_by: USUARIO,
    }]);
    assert.deepEqual((await db.query('SELECT * FROM public.transferencias_items')).rows, [{
      org_id: ORG, transferencia_id: resultado.id, ...ITEM, created_by: USUARIO, modified_by: USUARIO,
    }]);
    assert.deepEqual((await db.query('SELECT * FROM public.auditoria')).rows, [{
      org_id: ORG, usuario_id: USUARIO, accion, entidad: 'transferencias',
      entidad_id: resultado.id, nivel: 'info', detalle,
    }]);
  });
}

test('56: FK del segundo item (23503) deja 0 cabeceras, 0 items y 0 auditorias', async (t) => {
  const db = await prepararBase(t);
  await db.exec('SET ROLE service_role');
  await assert.rejects(crearTransferencia(db, 'transferencia_central', [
    ITEM, { ...ITEM, lote_id: LOTE_INEXISTENTE },
  ]), { code: '23503', constraint: 'transferencias_items_lote_id_fkey' });
  await db.exec('RESET ROLE');
  await comprobarSinEscrituras(db);
});

test('56: CHECK de auditoria (23514) deja 0 cabeceras, 0 items y 0 auditorias', async (t) => {
  const db = await prepararBase(t);
  await db.exec(`ALTER TABLE public.auditoria ADD CONSTRAINT fixture_rechazar_alta
    CHECK (accion <> 'CREAR_TRANSFERENCIA')`);
  await db.exec('SET ROLE service_role');
  await assert.rejects(crearTransferencia(db), { code: '23514', constraint: 'fixture_rechazar_alta' });
  await db.exec('RESET ROLE');
  await comprobarSinEscrituras(db);
});

test('56: anon, authenticated y un rol sin grants propios no pueden ejecutar (42501)', async (t) => {
  const db = await prepararBase(t);
  for (const rol of ['anon', 'authenticated', 'solo_public']) {
    await db.exec(`SET ROLE ${rol}`);
    await assert.rejects(crearTransferencia(db), {
      code: '42501', message: 'permission denied for function crear_transferencia',
    }, rol);
    await db.exec('RESET ROLE');
  }
  await comprobarSinEscrituras(db);
});
