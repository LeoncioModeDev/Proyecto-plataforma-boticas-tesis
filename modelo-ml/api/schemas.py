"""Schemas Pydantic para la API ML."""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, Field, field_validator


class NivelMadurez(str, Enum):
    SIN_DATOS = "SIN_DATOS"
    HISTORIAL_INICIAL = "HISTORIAL_INICIAL"
    HISTORIAL_INTERMEDIO = "HISTORIAL_INTERMEDIO"
    PREDICCION_LIMITADA = "PREDICCION_LIMITADA"
    MODELO_COMPLETO = "MODELO_COMPLETO"


class PrediccionRequest(BaseModel):
    botica_id: str = Field(..., examples=["bot-001"])
    producto_id: str = Field(..., examples=["prod-001"])
    horizonte: int = Field(12, ge=1, le=12, validation_alias=AliasChoices("horizonte", "horizonte_semanas"))
    demanda_inicial_manual: float | None = Field(None, ge=0)


class PrediccionesBoticaRequest(BaseModel):
    botica_id: str
    horizonte: int = Field(12, ge=1, le=12, validation_alias=AliasChoices("horizonte", "horizonte_semanas"))
    categoria_terapeutica: str | None = None
    producto_id: str | None = None
    solo_productos_con_historial: bool = False


class PrediccionesOrganizacionRequest(BaseModel):
    horizonte: int = Field(12, ge=1, le=12, validation_alias=AliasChoices("horizonte", "horizonte_semanas"))
    categoria_terapeutica: str | None = None
    solo_productos_con_historial: bool = False
    batch_size: int = Field(100, ge=1, le=500)


class PrediccionSemanal(BaseModel):
    periodo_inicio: str
    periodo_fin: str
    cantidad_predicha: float
    prediccion_sarima: float | None = None
    prediccion_xgboost: float | None = None
    metodo_aplicado: str | None = None
    alpha: float | None = None
    intervalo_inf: float
    intervalo_sup: float


class PrediccionResponse(BaseModel):
    org_id: str
    botica_id: str
    producto_id: str
    nivel_madurez: NivelMadurez
    estrategia_utilizada: str
    semanas_historial: int
    modelo_version_id: str
    horizonte_semanas: int
    predicciones: list[PrediccionSemanal]
    advertencias: list[str] = []


class MadurezResponse(BaseModel):
    org_id: str
    botica_id: str
    producto_id: str
    semanas_historial: int
    nivel_madurez: NivelMadurez
    estrategia_disponible: str
    sarima_disponible: bool
    xgboost_disponible: bool


class ReposicionRequest(BaseModel):
    botica_id: str
    drogueria_id: str
    producto_id: str
    horizonte_semanas: int = Field(12, ge=1, le=12)
    nivel_servicio: float = Field(0.90, ge=0.80, le=0.99)


class CompraRequest(BaseModel):
    almacen_id: str
    producto_id: str
    proveedor_id: str | None = None
    horizonte_semanas: int = Field(12, ge=1, le=12)
    nivel_servicio: float = Field(0.90, ge=0.80, le=0.99)


class RecomendacionResponse(BaseModel):
    recomendacion_id: str
    org_id: str
    tipo: Literal["REPOSICION_INTERNA", "ORDEN_COMPRA"]
    producto_id: str
    cantidad_recomendada: float
    cantidad_disponible_origen: float | None = None
    cantidad_final_transferible: float | None = None
    stock_disponible: float
    stock_comprometido: float = 0
    stock_en_transito: float
    stock_por_recibir: float
    stock_comprometido: float
    stock_seguridad: float
    metodo_stock_seguridad: str
    demanda_durante_lead_time: float
    fecha_sugerida: str
    prioridad: str
    motivo: str
    estado: str
    modelo_version_id: str
    cantidad_base: float | None = None
    cantidad_minima_compra: int | None = None
    multiplo_empaque: int | None = None
    cantidad_final: float | None = None
    lead_time_dias: int | None = None
    precio_referencial: float | None = None
    estrategia: str | None = None
    nivel_madurez: str | None = None
    proveedor_id: str | None = None
    botica_id: str | None = None


class ReentrenamientoRequest(BaseModel):
    alcance: Literal["GLOBAL", "ORGANIZACION"] = "GLOBAL"
    org_id: str | None = None
    forzar: bool = False

    @field_validator("org_id")
    @classmethod
    def validar_org_organizacion(cls, valor, info):
        if info.data.get("alcance") == "ORGANIZACION" and not valor:
            raise ValueError("org_id es requerido para alcance ORGANIZACION")
        return valor


class EstadoReentrenamiento(BaseModel):
    job_id: str
    estado: str
    alcance: str
    org_id: str | None = None
    mensaje: str | None = None
    creado_en: str
    actualizado_en: str


class AprobarRechazarResponse(BaseModel):
    recomendacion_id: str
    estado: str
    mensaje: str
    datos_para_plataforma: dict[str, Any]
