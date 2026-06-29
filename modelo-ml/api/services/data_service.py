"""Acceso a datos operativos locales o Supabase."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from ..config import RAIZ_MODELO, config
from ..repositories.supabase_repository import SupabaseRepository
from src.feature_engineering import CLAVES_SERIE, construir_features_historicas


class DataService:
    def __init__(self):
        self.repo = SupabaseRepository(config.supabase_url, config.supabase_service_role_key)
        self.features = self._leer_csv("data/features_modelado.csv", parse_dates=["fecha_semana"])
        self.series = self._leer_csv("data/series_sarima.csv", parse_dates=["fecha_semana"])
        self.predicciones = self._leer_csv("modelos/v1.0.0/predicciones.csv")
        self.recomendaciones: dict[str, dict] = {}

    def _leer_csv(self, ruta_relativa: str, parse_dates=None) -> pd.DataFrame:
        ruta = RAIZ_MODELO / ruta_relativa
        if not ruta.exists():
            return pd.DataFrame()
        return pd.read_csv(ruta, parse_dates=parse_dates)

    def productos_activos(self, org_id: str, botica_id: str | None = None, categoria: str | None = None) -> list[dict]:
        if self.repo.disponible:
            productos = self.repo.seleccionar_todo("productos", {"org_id": org_id, "estado": "activo"})
            if botica_id:
                ventas = self.repo.seleccionar_todo("ventas_historicas", {"org_id": org_id, "botica_id": botica_id}, select="producto_id")
                ids = {v["producto_id"] for v in ventas}
                productos = [p for p in productos if p["id"] in ids]
            resultado = []
            for p in productos:
                resultado.append({
                    "producto_id": p["id"],
                    "codigo_producto": p.get("codigo_interno"),
                    "nombre_comercial": p.get("nombre_comercial"),
                    "categoria_terapeutica": p.get("categoria_terapeutica") or p.get("clasificacion") or "SIN_CATEGORIA",
                })
            return resultado
        df = self.features[self.features["org_id"] == org_id]
        if botica_id:
            df = df[df["botica_id"] == botica_id]
        if categoria:
            df = df[df["categoria_terapeutica"] == categoria]
        cols = [c for c in ["producto_id", "codigo_producto", "nombre_comercial", "categoria_terapeutica"] if c in df.columns]
        return df[cols].drop_duplicates("producto_id").to_dict("records")

    def boticas(self, org_id: str) -> list[str]:
        if self.repo.disponible:
            return [b["id"] for b in self.repo.seleccionar_todo("boticas", {"org_id": org_id, "activa": True})]
        df = self.features[self.features["org_id"] == org_id]
        return sorted(df["botica_id"].dropna().unique().tolist())

    def serie(self, org_id: str, botica_id: str, producto_id: str) -> pd.DataFrame:
        if self.repo.disponible:
            return self._serie_supabase(org_id, botica_id, producto_id)
        return self.features[
            (self.features["org_id"] == org_id)
            & (self.features["botica_id"] == botica_id)
            & (self.features["producto_id"] == producto_id)
        ].sort_values("fecha_semana").copy()

    def categoria_promedio(self, org_id: str, categoria: str | None) -> float:
        if self.repo.disponible:
            ventas = self.repo.seleccionar_todo("ventas_historicas", {"org_id": org_id}, select="cantidad, fecha_venta", orden="fecha_venta")
            if not ventas:
                return 1.0
            df = pd.DataFrame(ventas)
            return float(df["cantidad"].tail(52).mean()) if "cantidad" in df.columns and not df.empty else 1.0
        df = self.features[self.features["org_id"] == org_id]
        if categoria:
            df = df[df["categoria_terapeutica"] == categoria]
        return float(df["cantidad_vendida"].tail(52).mean()) if not df.empty else 1.0

    def predicciones_guardadas(self, org_id: str, botica_id: str, producto_id: str) -> list[dict]:
        if self.repo.disponible:
            filas = self.repo.seleccionar_todo(
                "predicciones_ml",
                {"org_id": org_id, "botica_id": botica_id, "producto_id": producto_id},
                orden="periodo_inicio",
            )
            return [self._normalizar_prediccion_guardada(f) for f in filas]
        if self.predicciones.empty:
            return []
        serie = self.serie(org_id, botica_id, producto_id)
        if serie.empty:
            return []
        df = self.predicciones[
            (self.predicciones.get("org_id", org_id) == org_id)
            & (self.predicciones["botica_id"] == botica_id)
            & (self.predicciones["producto_id"] == producto_id)
        ].copy()
        return df.to_dict("records")

    def stock(self, org_id: str, ubicacion_id: str, producto_id: str) -> dict:
        if self.repo.disponible:
            filtros = {"org_id": org_id, "producto_id": producto_id}
            if ubicacion_id:
                filtros["ubicacion_id"] = ubicacion_id
            filas = self.repo.seleccionar("stock_ubicaciones", filtros, 1)
            if not filas:
                return self._stock_vacio()
            fila = filas[0]
            return {
                "stock_actual": float(fila.get("cantidad_disponible") or 0),
                "stock_minimo": float(fila.get("stock_minimo") or 0),
                "stock_maximo": float(fila.get("stock_maximo") or 0),
                "stock_comprometido": float(fila.get("stock_comprometido") or 0),
                "stock_en_transito": float(fila.get("stock_en_transito") or 0),
                "stock_por_recibir": float(fila.get("stock_por_recibir") or 0),
            }
        serie = self.features[
            (self.features["org_id"] == org_id)
            & (self.features["botica_id"] == ubicacion_id)
            & (self.features["producto_id"] == producto_id)
        ].sort_values("fecha_semana")
        if serie.empty:
            return {
                **self._stock_vacio(),
            }
        fila = serie.iloc[-1]
        return {
            "stock_actual": float(fila.get("stock_inicio_semana", 0)),
            "stock_minimo": float(fila.get("stock_minimo", 0)),
            "stock_maximo": float(fila.get("stock_maximo", 0)),
            "stock_comprometido": 0.0,
            "stock_en_transito": 0.0,
            "stock_por_recibir": 0.0,
        }

    def proveedor_producto(self, org_id: str, producto_id: str, proveedor_id: str | None = None) -> dict:
        if self.repo.disponible:
            filtros = {"producto_id": producto_id, "activo": True}
            if proveedor_id:
                filtros["proveedor_id"] = proveedor_id
            filas = self.repo.seleccionar_todo(
                "proveedor_producto",
                filtros,
                select="*, proveedores!inner(id, org_id, razon_social, activo)",
            )
            filas = [f for f in filas if f.get("proveedores", {}).get("org_id") == org_id and f.get("proveedores", {}).get("activo", True)]
            if not filas:
                return {
                    "proveedor_id": proveedor_id or None,
                    "lead_time_dias": 7,
                    "precio_referencial": 0.0,
                    "cantidad_minima_compra": 1,
                    "multiplo_empaque": 1,
                    "proveedor_nombre": None,
                }
            fila = filas[0]
            return {
                "proveedor_id": fila.get("proveedor_id"),
                "lead_time_dias": int(fila.get("lead_time_dias") or fila.get("lead_time_especifico") or 7),
                "precio_referencial": float(fila.get("precio_referencial") or fila.get("precio_compra_referencial") or fila.get("precio_compra") or 0),
                "cantidad_minima_compra": int(fila.get("cantidad_minima_compra") or 1),
                "multiplo_empaque": int(fila.get("multiplo_empaque") or 1),
                "proveedor_nombre": fila.get("proveedores", {}).get("razon_social"),
            }
        serie = self.features[(self.features["org_id"] == org_id) & (self.features["producto_id"] == producto_id)]
        lead_time = int(serie["lead_time_dias"].median()) if not serie.empty else 7
        return {
            "proveedor_id": proveedor_id or "proveedor-local",
            "lead_time_dias": lead_time,
            "precio_referencial": 0.0,
            "cantidad_minima_compra": 1,
            "multiplo_empaque": 1,
        }

    def guardar_recomendacion(self, recomendacion: dict) -> dict:
        if self.repo.disponible:
            datos = self._mapear_recomendacion_supabase(recomendacion)
            fila = self.repo.insertar("recomendaciones_ml", datos)
            recomendacion["recomendacion_id"] = fila.get("id", recomendacion["recomendacion_id"])
        self.recomendaciones[recomendacion["recomendacion_id"]] = recomendacion
        return recomendacion

    def cambiar_estado_recomendacion(self, recomendacion_id: str, estado: str) -> dict | None:
        if self.repo.disponible:
            estado_db = {"APROBADA": "confirmada", "RECHAZADA": "rechazada", "PENDIENTE": "pendiente"}.get(estado, estado.lower())
            filas = self.repo.actualizar("recomendaciones_ml", {"id": recomendacion_id}, {"estado": estado_db, "confirmado_en": datetime.now(timezone.utc).isoformat()})
            return filas[0] if filas else None
        rec = self.recomendaciones.get(recomendacion_id)
        if not rec:
            return None
        rec["estado"] = estado
        rec["actualizado_en"] = datetime.now(timezone.utc).isoformat()
        return rec

    def guardar_predicciones(self, respuesta: dict):
        if not self.repo.disponible:
            return []
        modelo_id = self.asegurar_modelo_ml()
        filas = []
        generado_en = datetime.now(timezone.utc).isoformat()
        for pred in respuesta.get("predicciones", []):
            filas.append({
                "org_id": respuesta["org_id"],
                "producto_id": respuesta["producto_id"],
                "botica_id": respuesta["botica_id"],
                "periodo_inicio": pred["periodo_inicio"],
                "periodo_fin": pred["periodo_fin"],
                "cantidad_predicha": pred["cantidad_predicha"],
                "intervalo_inf": pred["intervalo_inf"],
                "intervalosup": pred["intervalo_sup"],
                "intervalo_sup": pred["intervalo_sup"],
                "confianza": 0.9,
                "modelo_version_id": modelo_id,
                "estrategia": respuesta.get("estrategia_utilizada"),
                "nivel_madurez": str(respuesta.get("nivel_madurez")),
                "generado_en": generado_en,
            })
        if not filas:
            return []
        return self.repo.upsert("predicciones_ml", filas, on_conflict="org_id,botica_id,producto_id,modelo_version_id,periodo_inicio")

    def asegurar_modelo_ml(self) -> str:
        from .model_service import model_service

        modelo_id = model_service.modelo_version_id
        filas = self.repo.seleccionar("modelos_ml", {"id": modelo_id}, 1)
        if filas:
            return modelo_id
        metricas = model_service.metricas
        hibrido = metricas.get("modelos", {}).get("hibrido", {})
        split = metricas.get("split", {})
        self.repo.insertar("modelos_ml", {
            "id": modelo_id,
            "version": model_service.version,
            "algoritmo": "SARIMA+XGBoost",
            "hash": model_service.artefacto.get("hash", modelo_id),
            "fecha_entrenamiento": datetime.now(timezone.utc).isoformat(),
            "mae": hibrido.get("mae", 0),
            "rmse": hibrido.get("rmse", 0),
            "mape": hibrido.get("mape", 0),
            "psi_baseline_jsonb": model_service.drift.get("psi_features", {}),
            "datos_desde": split.get("train_inicio", "2024-01-01"),
            "datos_hasta": split.get("train_fin", "2026-01-01"),
            "status": "production",
            "activo": True,
        })
        return modelo_id

    def diagnostico(self, org_id: str) -> dict:
        if not self.repo.disponible:
            return {"status": "local", "supabase_connected": False, "organizacion_id": org_id, "boticas": 0, "productos": 0, "ventas_historicas": 0}
        org = self.repo.seleccionar("organizaciones", {"id": org_id}, 1)
        return {
            "status": "ok" if org else "sin_organizacion",
            "supabase_connected": True,
            "organizacion_id": org_id,
            "boticas": len(self.repo.seleccionar_todo("boticas", {"org_id": org_id}, select="id")),
            "productos": len(self.repo.seleccionar_todo("productos", {"org_id": org_id}, select="id")),
            "ventas_historicas": len(self.repo.seleccionar_todo("ventas_historicas", {"org_id": org_id}, select="id")),
        }

    def serie_valida(self, org_id: str) -> dict | None:
        if not self.repo.disponible:
            return None
        ventas = self.repo.seleccionar_todo("ventas_historicas", {"org_id": org_id}, select="botica_id, producto_id")
        if not ventas:
            return None
        df = pd.DataFrame(ventas)
        conteo = df.groupby(["botica_id", "producto_id"]).size().sort_values(ascending=False)
        for (botica_id, producto_id), semanas in conteo.items():
            stock = self.stock(org_id, botica_id, producto_id)
            proveedor = self.proveedor_producto(org_id, producto_id)
            if stock["stock_minimo"] >= 0:
                return {"org_id": org_id, "botica_id": botica_id, "producto_id": producto_id, "ventas": int(semanas), "tiene_proveedor": bool(proveedor.get("proveedor_id"))}
        return None

    def _serie_supabase(self, org_id: str, botica_id: str, producto_id: str) -> pd.DataFrame:
        ventas = self.repo.seleccionar_todo(
            "ventas_historicas",
            {"org_id": org_id, "botica_id": botica_id, "producto_id": producto_id},
            select="fecha_venta, cantidad",
            orden="fecha_venta",
        )
        if not ventas:
            return pd.DataFrame()
        df = pd.DataFrame(ventas)
        df["fecha_venta"] = pd.to_datetime(df["fecha_venta"])
        semanal = df.set_index("fecha_venta").resample("W-MON", label="left", closed="left")["cantidad"].sum().reset_index()
        semanal = semanal.rename(columns={"fecha_venta": "fecha_semana", "cantidad": "cantidad_vendida"})
        if semanal.empty:
            return semanal
        producto = self._producto(org_id, producto_id)
        stock = self.stock(org_id, botica_id, producto_id)
        proveedor = self.proveedor_producto(org_id, producto_id)
        semanal["org_id"] = org_id
        semanal["botica_id"] = botica_id
        semanal["producto_id"] = producto_id
        semanal["codigo_producto"] = producto.get("codigo_interno")
        semanal["nombre_comercial"] = producto.get("nombre_comercial")
        semanal["categoria_terapeutica"] = producto.get("categoria_terapeutica") or producto.get("clasificacion") or "SIN_CATEGORIA"
        semanal["demanda_insatisfecha"] = 0
        semanal["stockout_flag"] = 0
        semanal["stock_inicio_semana"] = stock["stock_actual"]
        semanal["stock_minimo"] = stock["stock_minimo"]
        semanal["stock_maximo"] = stock["stock_maximo"]
        semanal["lead_time_dias"] = proveedor["lead_time_dias"]
        return self._agregar_features(semanal)

    def _agregar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        df = df.sort_values([*CLAVES_SERIE, "fecha_semana"]).copy()
        return construir_features_historicas(df).fillna(0)

    def _producto(self, org_id: str, producto_id: str) -> dict[str, Any]:
        filas = self.repo.seleccionar("productos", {"org_id": org_id, "id": producto_id}, 1)
        return filas[0] if filas else {}

    def _stock_vacio(self) -> dict:
        return {"stock_actual": 0.0, "stock_minimo": 0.0, "stock_maximo": 0.0, "stock_comprometido": 0.0, "stock_en_transito": 0.0, "stock_por_recibir": 0.0}

    def _normalizar_prediccion_guardada(self, fila: dict) -> dict:
        fila = dict(fila)
        fila["intervalo_sup"] = fila.get("intervalo_sup") if fila.get("intervalo_sup") is not None else fila.get("intervalosup")
        return fila

    def _mapear_recomendacion_supabase(self, rec: dict) -> dict:
        estado = {"PENDIENTE": "pendiente", "APROBADA": "confirmada", "RECHAZADA": "rechazada"}.get(rec.get("estado"), "pendiente")
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
            "cantidad_sugerida": int(round(rec.get("cantidad_final", rec.get("cantidad_recomendada", 0)) or 0)),
            "motivo": rec.get("motivo", "Recomendación generada por modelo ML."),
            "confianza_modelo": rec.get("confianza", 0.9),
            "estado": estado,
            "stock_disponible": rec.get("stock_disponible"),
            "stock_comprometido": rec.get("stock_comprometido"),
            "stock_en_transito": rec.get("stock_en_transito"),
            "stock_por_recibir": rec.get("stock_por_recibir"),
            "stock_seguridad": rec.get("stock_seguridad"),
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
