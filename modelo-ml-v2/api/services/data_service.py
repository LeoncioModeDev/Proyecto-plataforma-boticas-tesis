"""Acceso a datos operativos locales o Supabase."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

import pandas as pd

from ..config import RAIZ_MODELO, config
from ..repositories.supabase_repository import SupabaseRepository


class DataService:
    def __init__(self):
        self.repo = SupabaseRepository(
            config.supabase_url,
            config.supabase_service_role_key,
        )
        self.series = self._leer_csv(
            "data/series_sarima.csv",
            parse_dates=["fecha_semana"],
        )
        self.features = self._leer_csv(
            "data/features_modelado.csv",
            parse_dates=["fecha_semana"],
        )
        self.productos_local = self._leer_csv("data/productos.csv")
        self.boticas_local = self._leer_csv("data/boticas.csv")
        self.stock_local = self._leer_csv("data/stock_ubicaciones.csv")
        self.proveedor_producto_local = self._leer_csv(
            "data/proveedor_producto.csv"
        )
        self.lotes_local = self._leer_csv("data/lotes.csv")
        self.recomendaciones: dict[str, dict] = {}
        self.alertas: dict[str, dict] = {}

        for df in [
            self.series,
            self.features,
            self.productos_local,
            self.boticas_local,
            self.stock_local,
            self.proveedor_producto_local,
            self.lotes_local,
        ]:
            self._normalizar_ids(df)

    def _leer_csv(self, ruta_relativa: str, parse_dates=None) -> pd.DataFrame:
        ruta = RAIZ_MODELO / ruta_relativa
        if not ruta.exists():
            return pd.DataFrame()
        return pd.read_csv(ruta, parse_dates=parse_dates)

    @staticmethod
    def _normalizar_ids(df: pd.DataFrame):
        if df.empty:
            return
        for columna in [
            "id",
            "org_id",
            "botica_id",
            "producto_id",
            "ubicacion_id",
            "proveedor_id",
        ]:
            if columna in df.columns:
                df[columna] = df[columna].astype(str)

    def productos_activos(
        self,
        org_id: str,
        botica_id: str | None = None,
        categoria: str | None = None,
    ) -> list[dict]:
        if self.repo.disponible:
            productos = self.repo.seleccionar_todo(
                "productos",
                {"org_id": org_id, "estado": "activo"},
            )
            if botica_id:
                ventas = self.repo.seleccionar_todo(
                    "ventas_historicas",
                    {"org_id": org_id, "botica_id": botica_id},
                    select="producto_id",
                )
                ids = {str(v["producto_id"]) for v in ventas}
                productos = [p for p in productos if str(p["id"]) in ids]
            resultado = []
            for p in productos:
                cat = (
                    p.get("categoria_terapeutica")
                    or p.get("clasificacion")
                    or "SIN_CATEGORIA"
                )
                if categoria and str(cat) != str(categoria):
                    continue
                resultado.append(
                    {
                        "producto_id": str(p["id"]),
                        "codigo_producto": p.get("codigo_interno"),
                        "nombre_comercial": p.get("nombre_comercial"),
                        "categoria_terapeutica": cat,
                    }
                )
            return resultado

        df = self.productos_local.copy()
        if df.empty:
            return []
        if "org_id" in df.columns:
            df = df[df["org_id"] == str(org_id)]
        if categoria and "categoria_terapeutica" in df.columns:
            df = df[df["categoria_terapeutica"] == categoria]
        if botica_id and not self.series.empty:
            ids = set(
                self.series[
                    (self.series["org_id"] == str(org_id))
                    & (self.series["botica_id"] == str(botica_id))
                ]["producto_id"].astype(str)
            )
            df = df[df["id"].astype(str).isin(ids)]
        return [
            {
                "producto_id": str(fila.get("id")),
                "codigo_producto": fila.get("codigo_interno"),
                "nombre_comercial": fila.get("nombre_comercial"),
                "categoria_terapeutica": fila.get(
                    "categoria_terapeutica", "SIN_CATEGORIA"
                ),
            }
            for _, fila in df.iterrows()
        ]

    def boticas(self, org_id: str) -> list[str]:
        if self.repo.disponible:
            return [
                str(b["id"])
                for b in self.repo.seleccionar_todo(
                    "boticas",
                    {"org_id": org_id, "activa": True, "tipo": "botica"},
                )
            ]
        if self.boticas_local.empty:
            return []
        df = self.boticas_local.copy()
        if "org_id" in df.columns:
            df = df[df["org_id"] == str(org_id)]
        if "tipo" in df.columns:
            df = df[df["tipo"].astype(str).str.lower() == "botica"]
        return df["id"].astype(str).dropna().unique().tolist()

    def drogueria_central(self, org_id: str) -> dict | None:
        if self.repo.disponible:
            filas = self.repo.seleccionar_todo(
                "boticas",
                {"org_id": org_id, "activa": True, "tipo": "drogueria"},
                orden="created_at",
                limite=1,
            )
            return filas[0] if filas else None
        if self.boticas_local.empty:
            return None
        df = self.boticas_local.copy()
        if "org_id" in df.columns:
            df = df[df["org_id"] == str(org_id)]
        if "tipo" in df.columns:
            df = df[df["tipo"].astype(str).str.lower() == "drogueria"]
        return df.iloc[0].to_dict() if not df.empty else None

    def serie(self, org_id: str, botica_id: str, producto_id: str) -> pd.DataFrame:
        if self.repo.disponible:
            return self._serie_supabase(org_id, botica_id, producto_id)

        if self.series.empty:
            return pd.DataFrame()
        df = self.series[
            (self.series["org_id"] == str(org_id))
            & (self.series["botica_id"] == str(botica_id))
            & (self.series["producto_id"] == str(producto_id))
        ].sort_values("fecha_semana").copy()
        if df.empty:
            return df

        categoria = self.categoria_producto(org_id, producto_id)
        df["categoria_terapeutica"] = categoria
        return df

    def categoria_producto(self, org_id: str, producto_id: str) -> str:
        if self.repo.disponible:
            filas = self.repo.seleccionar(
                "productos",
                {"org_id": org_id, "id": producto_id},
                1,
            )
            if filas:
                p = filas[0]
                return str(
                    p.get("categoria_terapeutica")
                    or p.get("clasificacion")
                    or "SIN_CATEGORIA"
                )
            return "SIN_CATEGORIA"

        if not self.productos_local.empty:
            df = self.productos_local[
                self.productos_local["id"].astype(str) == str(producto_id)
            ]
            if not df.empty:
                return str(
                    df.iloc[0].get(
                        "categoria_terapeutica",
                        "SIN_CATEGORIA",
                    )
                )
        if not self.features.empty:
            df = self.features[
                self.features["producto_id"].astype(str) == str(producto_id)
            ]
            if not df.empty and "categoria_terapeutica" in df.columns:
                return str(df.iloc[-1]["categoria_terapeutica"])
        return "SIN_CATEGORIA"

    def categoria_promedio(self, org_id: str, categoria: str | None) -> float:
        if self.repo.disponible:
            ventas = self.repo.seleccionar_todo(
                "vw_demanda_semanal_ml",
                {"org_id": org_id},
                select="cantidad_vendida,categoria_terapeutica,fecha_semana",
                orden="fecha_semana",
            )
            if not ventas:
                return 1.0
            df = pd.DataFrame(ventas)
            if categoria and "categoria_terapeutica" in df.columns:
                df = df[df["categoria_terapeutica"] == categoria]
            return (
                float(pd.to_numeric(df["cantidad_vendida"], errors="coerce").dropna().tail(52).mean())
                if not df.empty
                else 1.0
            )

        df = self.series[self.series["org_id"] == str(org_id)].copy()
        if categoria:
            productos = [
                p["producto_id"]
                for p in self.productos_activos(org_id, categoria=categoria)
            ]
            df = df[df["producto_id"].isin(productos)]
        return (
            float(df["cantidad_vendida"].tail(52).mean())
            if not df.empty
            else 1.0
        )

    def predicciones_guardadas(
        self,
        org_id: str,
        botica_id: str,
        producto_id: str,
    ) -> list[dict]:
        if not self.repo.disponible:
            return []
        filas = self.repo.seleccionar_todo(
            "predicciones_ml",
            {
                "org_id": org_id,
                "botica_id": botica_id,
                "producto_id": producto_id,
            },
            orden="periodo_inicio",
        )
        return [self._normalizar_prediccion_guardada(f) for f in filas]

    def stock(self, org_id: str, ubicacion_id: str, producto_id: str) -> dict:
        if self.repo.disponible:
            filtros = {"org_id": org_id, "producto_id": producto_id}
            ubicacion_tipo = "botica"
            ubicacion_real_id = ubicacion_id
            if ubicacion_id:
                boticas = self.repo.seleccionar(
                    "boticas",
                    {"org_id": org_id, "id": ubicacion_id},
                    1,
                )
                if boticas and boticas[0].get("tipo") == "drogueria":
                    ubicacion_tipo = "drogueria"
                    ubicacion_real_id = None
            filtros["ubicacion_tipo"] = ubicacion_tipo
            filtros["ubicacion_id"] = ubicacion_real_id
            filas = self.repo.seleccionar("stock_ubicaciones", filtros, 1)
            if not filas:
                return self._stock_vacio()
            return self._stock_desde_fila(filas[0])

        if self.stock_local.empty:
            return self._stock_vacio()
        df = self.stock_local[
            (self.stock_local["org_id"] == str(org_id))
            & (self.stock_local["producto_id"] == str(producto_id))
        ].copy()
        if "ubicacion_id" in df.columns:
            df = df[df["ubicacion_id"].astype(str) == str(ubicacion_id)]
        if df.empty:
            return self._stock_vacio()
        return self._stock_desde_fila(df.iloc[0].to_dict())

    def _stock_desde_fila(self, fila: dict) -> dict:
        return {
            "stock_actual": float(fila.get("cantidad_disponible") or 0),
            "stock_minimo": float(fila.get("stock_minimo") or 0),
            "stock_maximo": float(fila.get("stock_maximo") or 0),
            "stock_comprometido": float(fila.get("stock_comprometido") or 0),
            "stock_en_transito": float(fila.get("stock_en_transito") or 0),
            "stock_por_recibir": float(fila.get("stock_por_recibir") or 0),
        }

    def proveedor_producto(
        self,
        org_id: str,
        producto_id: str,
        proveedor_id: str | None = None,
    ) -> dict:
        if self.repo.disponible:
            filtros = {"producto_id": producto_id, "activo": True}
            if proveedor_id:
                filtros["proveedor_id"] = proveedor_id
            filas = self.repo.seleccionar_todo(
                "proveedor_producto",
                filtros,
                select="*, proveedores!inner(id, org_id, razon_social, activo)",
            )
            filas = [
                f
                for f in filas
                if f.get("proveedores", {}).get("org_id") == org_id
                and f.get("proveedores", {}).get("activo", True)
            ]
            if filas:
                return self._proveedor_desde_fila(filas[0])
            return self._proveedor_vacio(proveedor_id)

        if self.proveedor_producto_local.empty:
            return self._proveedor_vacio(proveedor_id)
        df = self.proveedor_producto_local[
            self.proveedor_producto_local["producto_id"].astype(str)
            == str(producto_id)
        ].copy()
        if "org_id" in df.columns:
            df = df[df["org_id"] == str(org_id)]
        if proveedor_id and "proveedor_id" in df.columns:
            df = df[df["proveedor_id"] == str(proveedor_id)]
        if df.empty:
            return self._proveedor_vacio(proveedor_id)
        return self._proveedor_desde_fila(df.iloc[0].to_dict())

    @staticmethod
    def _proveedor_desde_fila(fila: dict) -> dict:
        proveedores = fila.get("proveedores", {}) or {}
        return {
            "proveedor_id": fila.get("proveedor_id"),
            "lead_time_dias": int(
                fila.get("lead_time_dias")
                or fila.get("lead_time_especifico")
                or 7
            ),
            "precio_referencial": float(
                fila.get("precio_referencial")
                or fila.get("precio_compra_referencial")
                or fila.get("precio_compra")
                or 0
            ),
            "cantidad_minima_compra": int(
                fila.get("cantidad_minima_compra") or 1
            ),
            "multiplo_empaque": int(fila.get("multiplo_empaque") or 1),
            "proveedor_nombre": proveedores.get("razon_social"),
        }

    @staticmethod
    def _proveedor_vacio(proveedor_id: str | None = None) -> dict:
        return {
            "proveedor_id": proveedor_id,
            "lead_time_dias": 7,
            "precio_referencial": 0.0,
            "cantidad_minima_compra": 1,
            "multiplo_empaque": 1,
            "proveedor_nombre": None,
        }

    def lotes(self, org_id: str, botica_id: str, producto_id: str) -> list[dict]:
        if self.repo.disponible:
            filtros = {
                "org_id": org_id,
                "producto_id": producto_id,
            }
            filas = self.repo.seleccionar_todo(
                "lotes",
                filtros,
                orden="fecha_vencimiento",
            )
            resultado = []
            for fila in filas:
                ubicacion = fila.get("ubicacion_id") or fila.get("botica_id")
                if str(ubicacion) == str(botica_id):
                    resultado.append(fila)
            return resultado

        if self.lotes_local.empty:
            return []
        df = self.lotes_local[
            (self.lotes_local["org_id"] == str(org_id))
            & (self.lotes_local["producto_id"] == str(producto_id))
        ].copy()
        col = "ubicacion_id" if "ubicacion_id" in df.columns else "botica_id"
        if col in df.columns:
            df = df[df[col].astype(str) == str(botica_id)]
        return df.to_dict("records")

    def guardar_recomendacion(self, recomendacion: dict) -> dict:
        if self.repo.disponible:
            datos = self._mapear_recomendacion_supabase(recomendacion)
            fila = self.repo.insertar("recomendaciones_ml", datos)
            recomendacion["recomendacion_id"] = fila.get(
                "id", recomendacion["recomendacion_id"]
            )
        self.recomendaciones[recomendacion["recomendacion_id"]] = recomendacion
        return recomendacion

    def cambiar_estado_recomendacion(
        self,
        recomendacion_id: str,
        estado: str,
    ) -> dict | None:
        if self.repo.disponible:
            estado_db = {
                "APROBADA": "confirmada",
                "RECHAZADA": "rechazada",
                "PENDIENTE": "pendiente",
            }.get(estado, estado.lower())
            filas = self.repo.actualizar(
                "recomendaciones_ml",
                {"id": recomendacion_id},
                {
                    "estado": estado_db,
                    "confirmado_en": datetime.now(timezone.utc).isoformat(),
                },
            )
            return filas[0] if filas else None
        rec = self.recomendaciones.get(recomendacion_id)
        if not rec:
            return None
        rec["estado"] = estado
        rec["actualizado_en"] = datetime.now(timezone.utc).isoformat()
        return rec

    def aprobar_recomendacion_operativa(
        self,
        recomendacion_id: str,
        usuario_id: str,
    ) -> dict | None:
        if self.repo.disponible:
            return self.repo.rpc(
                "aprobar_recomendacion_operativa",
                {
                    "p_recomendacion_id": recomendacion_id,
                    "p_usuario_id": usuario_id,
                },
            )
        rec = self.recomendaciones.get(recomendacion_id)
        if not rec:
            return None
        rec["estado"] = "APROBADA"
        rec["actualizado_en"] = datetime.now(timezone.utc).isoformat()
        return {"exito": True, "estado": "confirmada"}

    def guardar_predicciones(self, respuesta: dict):
        if not self.repo.disponible:
            return []
        modelo_id = self.asegurar_modelo_ml()
        filas = []
        generado_en = datetime.now(timezone.utc).isoformat()
        nivel = respuesta.get("nivel_madurez")
        nivel_valor = getattr(nivel, "value", str(nivel))

        for pred in respuesta.get("predicciones", []):
            filas.append(
                {
                    "org_id": respuesta["org_id"],
                    "producto_id": respuesta["producto_id"],
                    "botica_id": respuesta["botica_id"],
                    "periodo_inicio": pred["periodo_inicio"],
                    "periodo_fin": pred["periodo_fin"],
                    "cantidad_predicha": pred["cantidad_predicha"],
                    "prediccion_sarima": pred.get("prediccion_sarima"),
                    "prediccion_xgboost": pred.get("prediccion_xgboost"),
                    "horizonte": pred.get("horizonte"),
                    # No se inventa un ±25 %. Se dejan nulos hasta contar con
                    # intervalos predictivos calibrados.
                    "intervalo_inf": pred.get("intervalo_inf"),
                    "intervalo_sup": pred.get("intervalo_sup"),
                    "confianza": None,
                    "modelo_version_id": modelo_id,
                    "estrategia": respuesta.get("estrategia_utilizada"),
                    "metodo_aplicado": pred.get("metodo_aplicado"),
                    "alpha": pred.get("alpha"),
                    "nivel_madurez": nivel_valor,
                    "generado_en": generado_en,
                }
            )
        if not filas:
            return []
        return self.repo.upsert(
            "predicciones_ml",
            filas,
            on_conflict=(
                "org_id,producto_id,botica_id,periodo_inicio,modelo_version_id"
            ),
        )

    def asegurar_modelo_ml(self) -> str:
        from .model_service import model_service

        datos_modelo = self._datos_modelo_ml_actual()
        filas = self.repo.seleccionar(
            "modelos_ml",
            {"version": model_service.version, "status": "production"},
            1,
        )
        if filas:
            return filas[0]["id"]

        produccion = self.repo.seleccionar(
            "modelos_ml",
            {"status": "production"},
            1,
        )
        if produccion:
            modelo_id = produccion[0]["id"]
            self.repo.actualizar("modelos_ml", {"id": modelo_id}, datos_modelo)
            return modelo_id

        import uuid

        modelo_id = str(uuid.uuid4())
        datos_modelo["id"] = modelo_id
        self.repo.insertar("modelos_ml", datos_modelo)
        return modelo_id

    def _datos_modelo_ml_actual(self) -> dict:
        from .model_service import model_service

        metricas = model_service.metricas
        globales = metricas.get("metricas_globales", [])
        hibrido = next(
            (
                fila
                for fila in globales
                if str(fila.get("modelo", "")).lower().replace("_", " ")
                == "sarima xgboost"
            ),
            {},
        )
        return {
            "version": model_service.version,
            "algoritmo": "SARIMA+XGBoost adaptativo",
            "hash": model_service.artefacto.get(
                "hash_datos_modelado", model_service.version
            ),
            "fecha_entrenamiento": model_service.artefacto.get(
                "fecha_entrenamiento_utc"
            ),
            "mae": hibrido.get("MAE", 0),
            "rmse": hibrido.get("RMSE", 0),
            "mape": hibrido.get("MAPE", 0),
            "macro_mape": metricas.get("macro_mape_hibrido"),
            "metricas_jsonb": metricas,
            "psi_baseline_jsonb": {},
            "datos_desde": "2024-01-01",
            "datos_hasta": "2026-05-04",
            "status": "production",
            "activo": True,
        }

    def guardar_alertas(self, alertas: list[dict]) -> list[dict]:
        if not alertas:
            return []
        if not self.repo.disponible:
            for alerta in alertas:
                self.alertas[alerta["id"]] = alerta
            return alertas

        guardadas = []
        for alerta in alertas:
            existentes = self.repo.seleccionar(
                "alertas_ml",
                {
                    "org_id": alerta["org_id"],
                    "condicion_hash": alerta["condicion_hash"],
                    "resuelta": False,
                },
                1,
            )
            if existentes:
                guardadas.append(existentes[0])
                continue
            datos = {
                "org_id": alerta["org_id"],
                "producto_id": alerta["producto_id"],
                "botica_id": alerta["botica_id"],
                "tipo": alerta["tipo"],
                "tipo_origen": alerta.get("tipo_origen", "modelo"),
                "urgencia": str(alerta["urgencia"]).lower(),
                "resuelta": False,
                "mensaje": alerta.get("mensaje"),
                "stock_actual": alerta.get("stock_actual"),
                "stock_proyectado": alerta.get("stock_proyectado"),
                "cantidad_recomendada": alerta.get("cantidad_recomendada"),
                "fecha_vencimiento": alerta.get("fecha_vencimiento"),
                "metadata_jsonb": alerta.get("metadata", {}),
                "datos_jsonb": alerta,
                "condicion_hash": alerta["condicion_hash"],
                "referencia_tipo": alerta.get("referencia_tipo"),
                "referencia_id": alerta.get("referencia_id"),
            }
            guardadas.append(self.repo.insertar("alertas_ml", datos))
        return guardadas

    def alertas_guardadas(self, org_id: str, solo_activas: bool = True) -> list[dict]:
        if self.repo.disponible:
            filtros: dict[str, Any] = {"org_id": org_id}
            if solo_activas:
                filtros["resuelta"] = False
            return self.repo.seleccionar_todo(
                "alertas_ml",
                filtros,
                orden="generado_en",
            )
        return [
            a
            for a in self.alertas.values()
            if a.get("org_id") == org_id
            and (not solo_activas or not a.get("resuelta", False))
        ]

    def registrar_auditoria(
        self,
        org_id: str,
        usuario_id: str | None,
        accion: str,
        entidad: str,
        entidad_id: str | None,
        detalle: str,
        metadata: dict | None = None,
    ):
        if not self.repo.disponible:
            return None
        return self.repo.insertar(
            "auditoria",
            {
                "org_id": org_id,
                "usuario_id": usuario_id,
                "accion": accion,
                "entidad": entidad,
                "entidad_id": entidad_id,
                "nivel": "info",
                "detalle": detalle,
                "metadata_jsonb": metadata or {},
            },
        )

    def resolver_alerta(
        self,
        alerta_id: str,
        usuario_id: str,
        comentario: str | None = None,
    ) -> dict | None:
        if self.repo.disponible:
            filas = self.repo.actualizar(
                "alertas_ml",
                {"id": alerta_id},
                {
                    "resuelta": True,
                    "resuelta_por": usuario_id,
                    "resuelta_en": datetime.now(timezone.utc).isoformat(),
                    "comentario_resolucion": comentario,
                },
            )
            return filas[0] if filas else None
        alerta = self.alertas.get(alerta_id)
        if not alerta:
            return None
        alerta["resuelta"] = True
        alerta["resuelta_por"] = usuario_id
        alerta["comentario_resolucion"] = comentario
        return alerta

    def diagnostico(self, org_id: str) -> dict:
        if not self.repo.disponible:
            return {
                "status": "local",
                "supabase_connected": False,
                "organizacion_id": org_id,
                "boticas": len(self.boticas(org_id)),
                "productos": len(self.productos_activos(org_id)),
                "ventas_historicas": int(len(self.series)),
            }
        org = self.repo.seleccionar("organizaciones", {"id": org_id}, 1)
        return {
            "status": "ok" if org else "sin_organizacion",
            "supabase_connected": True,
            "organizacion_id": org_id,
            "boticas": len(
                self.repo.seleccionar_todo(
                    "boticas", {"org_id": org_id}, select="id"
                )
            ),
            "productos": len(
                self.repo.seleccionar_todo(
                    "productos", {"org_id": org_id}, select="id"
                )
            ),
            "ventas_historicas": len(
                self.repo.seleccionar_todo(
                    "ventas_historicas", {"org_id": org_id}, select="id"
                )
            ),
        }

    def serie_valida(self, org_id: str) -> dict | None:
        if self.repo.disponible:
            filas = self.repo.seleccionar_todo(
                "vw_demanda_semanal_ml",
                {"org_id": org_id},
                select="botica_id,producto_id,fecha_semana",
            )
            if not filas:
                return None
            df = pd.DataFrame(filas)
        else:
            df = self.series[self.series["org_id"] == str(org_id)].copy()
            if df.empty:
                return None
        conteo = (
            df.groupby(["botica_id", "producto_id"])
            .size()
            .sort_values(ascending=False)
        )
        if conteo.empty:
            return None
        (botica_id, producto_id), semanas = conteo.index[0], int(conteo.iloc[0])
        return {
            "org_id": org_id,
            "botica_id": str(botica_id),
            "producto_id": str(producto_id),
            "semanas": semanas,
        }

    def _serie_supabase(
        self,
        org_id: str,
        botica_id: str,
        producto_id: str,
    ) -> pd.DataFrame:
        filas = self.repo.seleccionar_todo(
            "vw_demanda_semanal_ml",
            {
                "org_id": org_id,
                "botica_id": botica_id,
                "producto_id": producto_id,
            },
            select=(
                "fecha_semana,cantidad_vendida,categoria_terapeutica"
            ),
            orden="fecha_semana",
        )
        if not filas:
            return pd.DataFrame()
        df = pd.DataFrame(filas)
        df["fecha_semana"] = pd.to_datetime(df["fecha_semana"])
        df["cantidad_vendida"] = pd.to_numeric(
            df["cantidad_vendida"], errors="coerce"
        ).fillna(0.0)
        df["org_id"] = str(org_id)
        df["botica_id"] = str(botica_id)
        df["producto_id"] = str(producto_id)
        if "categoria_terapeutica" not in df.columns:
            df["categoria_terapeutica"] = self.categoria_producto(
                org_id, producto_id
            )
        else:
            df["categoria_terapeutica"] = df[
                "categoria_terapeutica"
            ].fillna(self.categoria_producto(org_id, producto_id))
        return df.sort_values("fecha_semana").reset_index(drop=True)

    @staticmethod
    def _stock_vacio() -> dict:
        return {
            "stock_actual": 0.0,
            "stock_minimo": 0.0,
            "stock_maximo": 0.0,
            "stock_comprometido": 0.0,
            "stock_en_transito": 0.0,
            "stock_por_recibir": 0.0,
        }

    @staticmethod
    def _normalizar_prediccion_guardada(fila: dict) -> dict:
        fila = dict(fila)
        if "intervalo_sup" not in fila:
            fila["intervalo_sup"] = fila.get("intervalosup")
        return fila

    @staticmethod
    def condicion_hash(*partes: Any) -> str:
        texto = "|".join(str(p) for p in partes)
        return hashlib.sha256(texto.encode("utf-8")).hexdigest()

    @staticmethod
    def _mapear_recomendacion_supabase(rec: dict) -> dict:
        estado = {
            "PENDIENTE": "pendiente",
            "APROBADA": "confirmada",
            "RECHAZADA": "rechazada",
        }.get(rec.get("estado"), "pendiente")
        tipo = "REPOSICION_INTERNA" if rec["tipo"] == "REPOSICION_INTERNA" else "COMPRA"
        return {
            "org_id": rec["org_id"],
            "producto_id": rec["producto_id"],
            "botica_destino_id": rec.get("botica_id") or rec.get("almacen_id"),
            "botica_origen_id": rec.get("drogueria_id"),
            "botica_id": rec.get("botica_id") or rec.get("almacen_id"),
            "proveedor_id": rec.get("proveedor_id"),
            "modelo_version_id": rec.get("modelo_version_id"),
            "tipo_recomendacion": tipo,
            "cantidad_sugerida": int(round(rec.get("cantidad_sugerida", rec.get("cantidad_final", rec.get("cantidad_recomendada", 0))) or 0)),
            "motivo": rec.get("motivo", "Recomendación generada por modelo ML."),
            "confianza_modelo": rec.get("confianza", 0.9),
            "estado": estado,
            "stock_disponible": rec.get("stock_disponible"),
            "stock_comprometido": rec.get("stock_comprometido"),
            "stock_en_transito": rec.get("stock_en_transito"),
            "stock_por_recibir": rec.get("stock_por_recibir"),
            "stock_libre": rec.get("stock_libre"),
            "stock_considerado": rec.get("stock_considerado"),
            "stock_proyectado": rec.get("stock_proyectado"),
            "stock_seguridad": rec.get("stock_seguridad"),
            "metodo_stock_seguridad": rec.get("metodo_stock_seguridad"),
            "demanda_durante_lead_time": rec.get("demanda_durante_lead_time"),
            "cantidad_base": rec.get("cantidad_base"),
            "cantidad_minima_compra": rec.get("cantidad_minima_compra"),
            "multiplo_empaque": rec.get("multiplo_empaque"),
            "cantidad_final": rec.get("cantidad_final"),
            "lead_time_dias": rec.get("lead_time_dias"),
            "precio_referencial": rec.get("precio_referencial"),
            "estrategia": rec.get("estrategia"),
            "nivel_madurez": rec.get("nivel_madurez"),
            "datos_jsonb": rec,
        }


data_service = DataService()
