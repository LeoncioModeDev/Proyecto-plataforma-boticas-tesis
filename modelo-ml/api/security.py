"""Dependencias de seguridad y resolución de organización."""

from __future__ import annotations

from fastapi import Header

from .config import config
from .errors import error_http
from .repositories.supabase_repository import SupabaseRepository


repo_seguridad = SupabaseRepository(config.supabase_url, config.supabase_service_role_key)


def _token_bearer(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip()


def obtener_perfil_autenticado(
    x_org_id: str | None = Header(default=None, alias="X-Org-Id"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> dict:
    if not config.modo_supabase:
        if not x_org_id:
            error_http(401, "ORG_REQUERIDA", "Debe enviar X-Org-Id en modo local sin Supabase.")
        return {"id": "local", "org_id": x_org_id, "rol": "admin_central", "activo": True, "botica_id": None}

    token = _token_bearer(authorization)
    if not token:
        error_http(401, "TOKEN_REQUERIDO", "Debe enviar Authorization: Bearer <token>.")

    try:
        usuario = repo_seguridad.usuario_por_jwt(token)
    except Exception:
        error_http(401, "TOKEN_INVALIDO", "Token inválido o expirado.")
    if not usuario:
        error_http(401, "TOKEN_INVALIDO", "Token inválido o expirado.")

    perfil = repo_seguridad.perfil_usuario(usuario["id"])
    if not perfil:
        error_http(403, "PERFIL_NO_ENCONTRADO", "Perfil de usuario no encontrado.")
    if not perfil.get("activo", True):
        error_http(403, "USUARIO_INACTIVO", "Usuario desactivado.")
    if not perfil.get("org_id"):
        error_http(403, "ORG_REQUERIDA", "El usuario no tiene organización asignada.")
    if x_org_id and x_org_id != perfil["org_id"]:
        error_http(403, "ORG_CONFLICTO", "El org_id del usuario no coincide con X-Org-Id.")
    return perfil


def obtener_org_id(
    x_org_id: str | None = Header(default=None, alias="X-Org-Id"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> str:
    return obtener_perfil_autenticado(x_org_id, authorization)["org_id"]
