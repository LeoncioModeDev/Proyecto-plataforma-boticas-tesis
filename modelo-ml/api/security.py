"""Dependencias de seguridad y resolución de organización."""

from __future__ import annotations

from fastapi import Header

from .errors import error_http


try:
    import jwt
except Exception:  # PyJWT puede no estar instalado durante pruebas locales iniciales.
    jwt = None


def _org_desde_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer ") or jwt is None:
        return None
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
    except Exception:
        return None
    metadata = payload.get("user_metadata") or payload.get("app_metadata") or {}
    return payload.get("org_id") or payload.get("organization_id") or metadata.get("org_id")


def obtener_org_id(
    x_org_id: str | None = Header(default=None, alias="X-Org-Id"),
    authorization: str | None = Header(default=None, alias="Authorization"),
) -> str:
    org_token = _org_desde_token(authorization)
    org_id = org_token or x_org_id
    if not org_id:
        error_http(401, "ORG_REQUERIDA", "Debe enviar X-Org-Id o un JWT con org_id.")
    if org_token and x_org_id and org_token != x_org_id:
        error_http(403, "ORG_CONFLICTO", "El org_id del token no coincide con X-Org-Id.")
    return org_id
