import pandas as pd
import logging
import datetime
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from typing import Optional
from app.repositories.mba3_repository import IMba3Repository


class EstadisticasVentasService:
    """
    Servicio para el Reporte de Ventas (Estadísticas de Inventario): una fila
    por producto con lo vendido en el rango + existencia actual del ERP.
    Replica el reporte nativo "Estadisticas de Inventarios" del ERP.
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository

    def obtener_estadisticas(self, fecha_inicio: str, fecha_fin: str, db: Optional[Session] = None) -> pd.DataFrame:
        logging.info(f"EstadisticasService: consultando {fecha_inicio} a {fecha_fin}")

        close_db_manually = False
        if db is None:
            db = SessionLocal()
            close_db_manually = True

        try:
            # DISTINCT ON (codigo) con ORDER BY fecha DESC se queda con la fila de la
            # ultima venta (de ahi sale "ultimo precio"); las columnas con OVER(PARTITION
            # BY codigo) se calculan sobre TODO el rango sin importar cual fila gano el DISTINCT ON.
            query_sql = """
                SELECT DISTINCT ON (codigo)
                    codigo,
                    producto,
                    unidad,
                    grupo,
                    subgrupo,
                    precio_venta AS ultimo_precio,
                    fecha AS ultima_fecha_venta,
                    SUM(cantidad) OVER (PARTITION BY codigo) AS unidades_vendidas,
                    SUM(total_linea) OVER (PARTITION BY codigo) AS total_ventas,
                    MAX(precio_venta) OVER (PARTITION BY codigo) AS precio_maximo,
                    MIN(precio_venta) OVER (PARTITION BY codigo) AS precio_minimo
                FROM view_ventas_espejo_reporte
                WHERE fecha BETWEEN :inicio AND :fin
                  -- Ruido promocional/regalo, no son ventas reales de producto.
                  AND producto NOT ILIKE '%GLOBO%'
                  AND producto NOT ILIKE '%FUNDA%'
                ORDER BY codigo, fecha DESC
            """
            with db.get_bind().connect() as conn:
                result = conn.execute(text(query_sql), {"inicio": fecha_inicio, "fin": fecha_fin})
                rows = result.fetchall()
                keys = result.keys()

            if not rows:
                logging.info("EstadisticasService: sin ventas en el rango.")
                return pd.DataFrame()

            df = pd.DataFrame([dict(zip(keys, row)) for row in rows])
            # Postgres devuelve NUMERIC como Decimal (dtype object): forzar a float
            # antes de cualquier operacion vectorizada (round/division fallan en object).
            for col in ["unidades_vendidas", "total_ventas", "precio_maximo", "precio_minimo", "ultimo_precio"]:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

            df["ultima_fecha_venta"] = pd.to_datetime(df["ultima_fecha_venta"])
            hoy = pd.Timestamp(datetime.date.today())
            df["no_dias"] = (hoy - df["ultima_fecha_venta"]).dt.days
            df["ultima_fecha_venta"] = df["ultima_fecha_venta"].dt.strftime("%Y-%m-%d")
            df["precio_promedio"] = (df["total_ventas"] / df["unidades_vendidas"].replace(0, pd.NA)).fillna(0).round(4)

            # Existencia actual (OH/COMMITED/AVAILABLE): es "ahora", no depende del rango.
            stock = self._obtener_stock_actual()
            df["codigo"] = df["codigo"].astype(str).str.strip()
            df = df.merge(stock, on="codigo", how="left")
            for col in ["existencia", "asignado", "disponible"]:
                df[col] = df[col].fillna(0)

            # Servicios (PRODUCT_TYPE del ERP) no son inventario fisico - existencia
            # negativa/sin sentido si se cuelan aqui (ej: "SERVICIO TECNICO").
            if "product_type" in df.columns:
                df = df[df["product_type"] != "Servicio"].drop(columns=["product_type"])

            return df.sort_values(by="unidades_vendidas", ascending=False)
        finally:
            if close_db_manually:
                db.close()

    def _obtener_stock_actual(self) -> pd.DataFrame:
        token = self.repository.obtener_token()
        if not token:
            logging.error("EstadisticasService: no se pudo obtener token para stock actual.")
            return pd.DataFrame(columns=["codigo", "existencia", "asignado", "disponible"])

        datos = self.repository.ejecutar_consulta(
            token=token,
            select="PRODUCT_ID_CORP,OH,COMMITED,AVAILABLE,PRODUCT_TYPE",
            table="INVT_Ficha_Principal",
            limit=100000
        )
        if not datos:
            return pd.DataFrame(columns=["codigo", "existencia", "asignado", "disponible", "product_type"])

        df = pd.DataFrame(datos)
        mapeo = {c.replace(" ", "").replace("_", "").upper(): c for c in df.columns}
        col_codigo = mapeo.get("PRODUCTIDCORP")
        col_oh = mapeo.get("OH")
        col_commited = mapeo.get("COMMITED")
        col_available = mapeo.get("AVAILABLE")
        col_tipo = mapeo.get("PRODUCTTYPE")

        out = pd.DataFrame()
        out["codigo"] = df[col_codigo].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
        out["existencia"] = pd.to_numeric(df[col_oh], errors="coerce").fillna(0) if col_oh else 0
        out["asignado"] = pd.to_numeric(df[col_commited], errors="coerce").fillna(0) if col_commited else 0
        out["disponible"] = pd.to_numeric(df[col_available], errors="coerce").fillna(0) if col_available else 0
        out["product_type"] = df[col_tipo].astype(str).str.strip() if col_tipo else ""
        return out.drop_duplicates(subset=["codigo"])
