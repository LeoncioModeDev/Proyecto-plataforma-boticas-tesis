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

    def insertar(self, tabla: str, datos: dict) -> dict:
        if not self.client:
            return datos
        respuesta = self.client.table(tabla).insert(datos).execute()
        return (respuesta.data or [datos])[0]

    def actualizar(self, tabla: str, filtros: dict[str, Any], datos: dict) -> list[dict]:
        if not self.client:
            return []
        query = self.client.table(tabla).update(datos)
        for columna, valor in filtros.items():
            query = query.eq(columna, valor)
        respuesta = query.execute()
        return respuesta.data or []
