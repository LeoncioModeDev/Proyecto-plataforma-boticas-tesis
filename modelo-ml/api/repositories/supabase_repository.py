"""Repositorio Supabase con fallback local preparado."""

from __future__ import annotations

from typing import Any


class SupabaseRepository:
    def __init__(self, url: str | None, service_role_key: str | None):
        self.url = url
        self.service_role_key = service_role_key
        self.client = None
        if url and service_role_key:
            from supabase import create_client

            self.client = create_client(url, service_role_key)

    @property
    def disponible(self) -> bool:
        return self.client is not None

    def seleccionar(self, tabla: str, filtros: dict[str, Any] | None = None, limite: int | None = None) -> list[dict]:
        if not self.client:
            return []
        query = self.client.table(tabla).select("*")
        for columna, valor in (filtros or {}).items():
            query = query.eq(columna, valor)
        if limite:
            query = query.limit(limite)
        respuesta = query.execute()
        return respuesta.data or []

    def seleccionar_todo(self, tabla: str, filtros: dict[str, Any] | None = None, select: str = "*", orden: str | None = None, limite: int = 1000) -> list[dict]:
        if not self.client:
            return []
        registros: list[dict] = []
        inicio = 0
        while True:
            query = self.client.table(tabla).select(select)
            for columna, valor in (filtros or {}).items():
                if valor is None:
                    query = query.is_(columna, "null")
                else:
                    query = query.eq(columna, valor)
            if orden:
                query = query.order(orden)
            respuesta = query.range(inicio, inicio + limite - 1).execute()
            lote = respuesta.data or []
            registros.extend(lote)
            if len(lote) < limite:
                break
            inicio += limite
        return registros

    def insertar(self, tabla: str, datos: dict) -> dict:
        if not self.client:
            return datos
        respuesta = self.client.table(tabla).insert(datos).execute()
        return (respuesta.data or [datos])[0]

    def upsert(self, tabla: str, datos: dict | list[dict], on_conflict: str | None = None) -> list[dict]:
        if not self.client:
            return datos if isinstance(datos, list) else [datos]
        query = self.client.table(tabla).upsert(datos, on_conflict=on_conflict) if on_conflict else self.client.table(tabla).upsert(datos)
        respuesta = query.execute()
        return respuesta.data or (datos if isinstance(datos, list) else [datos])

    def actualizar(self, tabla: str, filtros: dict[str, Any], datos: dict) -> list[dict]:
        if not self.client:
            return []
        query = self.client.table(tabla).update(datos)
        for columna, valor in filtros.items():
            query = query.eq(columna, valor)
        respuesta = query.execute()
        return respuesta.data or []

    def usuario_por_jwt(self, jwt: str) -> dict | None:
        if not self.client:
            return None
        respuesta = self.client.auth.get_user(jwt)
        return respuesta.user.model_dump() if respuesta and respuesta.user else None

    def perfil_usuario(self, usuario_id: str) -> dict | None:
        filas = self.seleccionar("usuarios", {"id": usuario_id}, 1)
        return filas[0] if filas else None
