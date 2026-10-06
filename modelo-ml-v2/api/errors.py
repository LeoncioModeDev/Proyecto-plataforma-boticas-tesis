"""Errores HTTP homogéneos."""

from fastapi import HTTPException


def error_http(status_code: int, codigo: str, mensaje: str, detalle=None):
    raise HTTPException(
        status_code=status_code,
        detail={"error": {"codigo": codigo, "mensaje": mensaje, "detalle": detalle}},
    )
