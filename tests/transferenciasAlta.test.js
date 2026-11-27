import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const fuente = readFileSync(new URL('../supabase/functions/transferencias/index.ts', import.meta.url), 'utf8');
const codigo = stripTypeScriptTypes(fuente.replace(/^import .*\r?\n/, ''));
const item = { producto_id: 'producto', lote_id: 'lote', cantidad: 3 };

async function ejecutarAlta({ tipo = 'transferencia_central', rol = 'admin_central', cantidad = 3, errorRpc = null } = {}) {
  const esRedistribucion = tipo === 'redistribucion';
  const llamadas = [];
  const datos = { exito: true, id: 'transferencia', numero_transferencia: 'TRF-000001' };
  const cliente = {
    auth: { getUser: async () => ({ data: { user: { id: 'actor' } } }) },
    from(tabla) {
      const filtros = {};
      const consulta = {
        select: () => consulta,
        eq(columna, valor) { filtros[columna] = valor; return consulta; },
        is: () => consulta,
        in: async () => ({ data: [{ id: 'producto', estado: 'activo' }] }),
        single: async () => buscar(),
        maybeSingle: async () => buscar(),
        insert: () => assert.fail(`Escritura inesperada fuera de la RPC: ${tabla}`),
      };
      function buscar() {
        switch (tabla) {
          case 'usuarios': return { data: { id: 'actor', rol, org_id: 'org', activo: true } };
          case 'boticas': return { data: { id: filtros.id ?? 'central', org_id: 'org', activa: true, tipo: 'botica' } };
          case 'lotes': return { data: { producto_id: 'producto', ubicacion_id: esRedistribucion ? 'origen' : null, org_id: 'org', cantidad: 9 } };
          case 'stock_ubicaciones': return { data: { stock_fisico: 9, stock_comprometido: 2 } };
          default: assert.fail(`Consulta inesperada: ${tabla}`);
        }
      }
      return consulta;
    },
    async rpc(nombre, args) {
      llamadas.push([nombre, structuredClone(args)]);
      return errorRpc ? { error: errorRpc } : { data: datos };
    },
  };
  let atender;
  runInNewContext(codigo, {
    Deno: { env: { get: () => 'local' }, serve: (handler) => { atender = handler; } },
    createClient: () => cliente,
    URL,
    Response,
    console,
  });
  const respuesta = await atender(new Request('http://localhost/transferencias', {
    method: 'POST',
    headers: { Authorization: 'Bearer local' },
    body: JSON.stringify({
      tipo_transferencia: tipo, origen_id: 'origen', destino_id: 'destino',
      items: [{ ...item, cantidad, org_id: 'ignorar', stock_comprometido: true }],
    }),
  }));
  return { respuesta, llamadas, datos };
}

for (const [tipo, origen] of [['transferencia_central', 'central'], ['redistribucion', 'origen']]) {
  test(`${tipo}: una sola RPC conserva la respuesta de alta`, async () => {
    const { respuesta, llamadas, datos } = await ejecutarAlta({ tipo });
    assert.equal(respuesta.status, 200);
    assert.deepEqual(await respuesta.json(), datos);
    assert.deepEqual(llamadas, [['crear_transferencia', {
      p_org_id: 'org', p_usuario_id: 'actor', p_tipo_transferencia: tipo,
      p_origen_id: origen, p_destino_id: 'destino', p_observaciones: null, p_items: [item],
    }]]);
  });
}

test('el rol no permitido y el stock insuficiente no llegan a la RPC', async () => {
  for (const [opciones, estado] of [[{ rol: 'visor_botica' }, 403], [{ cantidad: 8 }, 400]]) {
    const { respuesta, llamadas } = await ejecutarAlta(opciones);
    assert.equal(respuesta.status, estado);
    assert.deepEqual(llamadas, []);
  }
});

test('una colision de lock devuelve conflicto sin reintentar el alta', async () => {
  const { respuesta, llamadas } = await ejecutarAlta({ errorRpc: { code: '55P03' } });
  assert.equal(respuesta.status, 409);
  assert.equal(llamadas.length, 1);
});
