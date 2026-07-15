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
    por producto (catálogo completo, NVC01 + ENV01) con existencia actual y lo
    vendido en el rango. Replica el reporte nativo "Estadisticas de Inventarios"
    del ERP, pero sin restringir a una sola empresa - el front filtra por empresa.
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository

    def obtener_estadisticas(self, fecha_inicio: str, fecha_fin: str, db: Optional[Session] = None) -> pd.DataFrame:
        logging.info(f"EstadisticasService: consultando {fecha_inicio} a {fecha_fin}")

        # 1. Catalogo completo (ambas empresas): existencia actual es "ahora",
        # no depende del rango - por eso el catalogo es la base (left) y las
        # ventas se le pegan encima. Asi los productos sin venta en el rango
        # tambien aparecen (con 0 en las columnas de venta), igual que el reporte del ERP.
        catalogo = self._obtener_catalogo()
        if catalogo.empty:
            logging.error("EstadisticasService: no se pudo obtener el catálogo de productos.")
            return pd.DataFrame()

        # 2. Ventas agregadas por producto en el rango.
        ventas = self._obtener_ventas_agregadas(fecha_inicio, fecha_fin, db)

        df = catalogo.merge(ventas, on="codigo", how="left")
        for col in ["unidades_vendidas", "total_ventas", "precio_maximo", "precio_minimo", "ultimo_precio"]:
            df[col] = df[col].fillna(0)
        df["ultima_fecha_venta"] = df["ultima_fecha_venta"].fillna("")
        df["precio_promedio"] = (df["total_ventas"] / df["unidades_vendidas"].replace(0, pd.NA)).fillna(0).round(4)

        hoy = pd.Timestamp(datetime.date.today())
        fecha_dt = pd.to_datetime(df["ultima_fecha_venta"], errors="coerce")
        no_dias = (hoy - fecha_dt).dt.days
        # NaN (producto sin ventas en el rango) rompe la serializacion JSON - None en su lugar.
        df["no_dias"] = no_dias.astype(object).where(no_dias.notna(), None)

        # Ruido promocional/regalo y servicios (no son productos fisicos reales).
        df = df[~df["producto"].str.upper().str.contains("GLOBO", na=False)]
        df = df[~df["producto"].str.upper().str.contains("FUNDA", na=False)]
        df = df[df["product_type"] != "Servicio"]
        df = df.drop(columns=["product_type"])

        return df.sort_values(by="unidades_vendidas", ascending=False)

    def _obtener_ventas_agregadas(self, fecha_inicio: str, fecha_fin: str, db: Optional[Session] = None) -> pd.DataFrame:
        close_db_manually = False
        if db is None:
            db = SessionLocal()
            close_db_manually = True
        try:
            # DISTINCT ON (codigo) con ORDER BY fecha DESC se queda con la fila de la
            # ultima venta (de ahi sale "ultimo precio"); las columnas con OVER(PARTITION
            # BY codigo) se calculan sobre TODO el rango sin importar cual fila gano el DISTINCT ON.
            # codigo ya incluye el sufijo de empresa (ej. "1CINF9365-NVC01"), asi que
            # NVC01 y ENV01 quedan separados naturalmente.
            query_sql = """
                SELECT DISTINCT ON (codigo)
                    codigo,
                    precio_venta AS ultimo_precio,
                    fecha AS ultima_fecha_venta,
                    SUM(cantidad) OVER (PARTITION BY codigo) AS unidades_vendidas,
                    SUM(total_linea) OVER (PARTITION BY codigo) AS total_ventas,
                    MAX(precio_venta) OVER (PARTITION BY codigo) AS precio_maximo,
                    MIN(precio_venta) OVER (PARTITION BY codigo) AS precio_minimo
                FROM view_ventas_espejo_reporte
                WHERE fecha BETWEEN :inicio AND :fin
                ORDER BY codigo, fecha DESC
            """
            with db.get_bind().connect() as conn:
                result = conn.execute(text(query_sql), {"inicio": fecha_inicio, "fin": fecha_fin})
                rows = result.fetchall()
                keys = result.keys()

            if not rows:
                return pd.DataFrame(columns=["codigo", "ultimo_precio", "ultima_fecha_venta", "unidades_vendidas", "total_ventas", "precio_maximo", "precio_minimo"])

            df = pd.DataFrame([dict(zip(keys, row)) for row in rows])
            for col in ["unidades_vendidas", "total_ventas", "precio_maximo", "precio_minimo", "ultimo_precio"]:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)
            df["ultima_fecha_venta"] = pd.to_datetime(df["ultima_fecha_venta"]).dt.strftime("%Y-%m-%d")
            df["codigo"] = df["codigo"].astype(str).str.strip()
            return df
        finally:
            if close_db_manually:
                db.close()

    def _obtener_catalogo(self) -> pd.DataFrame:
        token = self.repository.obtener_token()
        if not token:
            logging.error("EstadisticasService: no se pudo obtener token para el catálogo.")
            return pd.DataFrame()

        datos = self.repository.ejecutar_consulta(
            token=token,
            select="PRODUCT_ID_CORP,PRODUCT_NAME,UM,GROUP_CODE,SUB_GROUP_CODE,OH,COMMITED,AVAILABLE,PRODUCT_TYPE,CORP",
            table="INVT_Ficha_Principal",
            limit=200000
        )
        if not datos:
            return pd.DataFrame()

        df = pd.DataFrame(datos)
        mapeo = {c.replace(" ", "").replace("_", "").upper(): c for c in df.columns}
        col_codigo = mapeo.get("PRODUCTIDCORP")
        col_nombre = mapeo.get("PRODUCTNAME")
        col_um = mapeo.get("UM")
        col_grupo = mapeo.get("GROUPCODE")
        col_subgrupo = mapeo.get("SUBGROUPCODE")
        col_oh = mapeo.get("OH")
        col_commited = mapeo.get("COMMITED")
        col_available = mapeo.get("AVAILABLE")
        col_tipo = mapeo.get("PRODUCTTYPE")
        col_corp = mapeo.get("CORP")

        out = pd.DataFrame()
        out["codigo"] = df[col_codigo].astype(str).str.replace(r'\.0$', '', regex=True).str.strip()
        out["producto"] = df[col_nombre].astype(str).str.strip().str.upper() if col_nombre else ""
        out["unidad"] = df[col_um].astype(str).str.strip().str.upper() if col_um else ""
        out["grupo"] = (df[col_grupo].astype(str).str.strip().replace("", "GENERAL").fillna("GENERAL")) if col_grupo else "GENERAL"
        out["subgrupo"] = (df[col_subgrupo].astype(str).str.strip().replace("", "GENERAL").fillna("GENERAL")) if col_subgrupo else "GENERAL"
        out["existencia"] = pd.to_numeric(df[col_oh], errors="coerce").fillna(0) if col_oh else 0
        out["asignado"] = pd.to_numeric(df[col_commited], errors="coerce").fillna(0) if col_commited else 0
        out["disponible"] = pd.to_numeric(df[col_available], errors="coerce").fillna(0) if col_available else 0
        out["product_type"] = df[col_tipo].astype(str).str.strip() if col_tipo else ""
        empresa_raw = df[col_corp].astype(str).str.strip() if col_corp else ""
        out["empresa"] = empresa_raw
        out["empresa_nombre"] = empresa_raw.map({"NVC01": "NOVICOMPU", "ENV01": "ENV"}).fillna(empresa_raw)
        return out.drop_duplicates(subset=["codigo"])
