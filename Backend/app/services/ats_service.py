import pandas as pd
import logging
from app.repositories.mba3_repository import IMba3Repository

class AtsService:
    """
    Servicio de Reglas de Negocio para el Reporte Fiscal ATS.
    Cruza Facturas con Proveedores e Info Fiscal, ejecutando filtros lógicos en RAM.
    """
    def __init__(self, repository: IMba3Repository):
        self.repository = repository
        
    def obtener_ats(self, fecha_inicio: str, fecha_fin: str) -> pd.DataFrame:
        logging.info(f"Service: Procesando ATS desde {fecha_inicio} hasta {fecha_fin}")
        token = self.repository.obtener_token()
        if not token:
            logging.error("Service: No se pudo obtener el token para realizar la consulta.")
            return pd.DataFrame()
            
        # 1. Cabecera de Facturas
        cols_factura = "INVOICE_DATE,CORP,VENDOR_ID,MEMO,INVOICE_TOTAL,DOC_REFERENCE,TotalProductosConIVa,TotalServiciosConIVa,TotalProductosSinIVa,TotalServiciosSinIVa,VOID,DOC_ID_CORP,CONFIRMED"
        where_factura = f"INVOICE_DATE >= '{fecha_inicio}' AND INVOICE_DATE <= '{fecha_fin}'"
        
        datos_factura = self.repository.ejecutar_consulta(
            token=token,
            select=cols_factura,
            table="PROV_Factura_Principal",
            where=where_factura,
            limit=100000
        )
        if not datos_factura:
            logging.warning("Service: Tabla de facturas de compras vacía para el rango de fechas.")
            return pd.DataFrame()
        df_facturas = pd.DataFrame(datos_factura)
        
        # 2. Catálogo de Proveedores
        cols_proveedor = "VENDOR_ID,VENDOR_NAME,RUC_or_FED_ID"
        datos_proveedor = self.repository.ejecutar_consulta(
            token=token,
            select=cols_proveedor,
            table="PROV_Ficha_Principal",
            limit=100000
        )
        if not datos_proveedor:
            logging.warning("Service: Catálogo de proveedores vacío.")
            return pd.DataFrame()
        df_proveedores = pd.DataFrame(datos_proveedor)
        
        # 3. Información Fiscal Relacionada
        cols_fiscal = "MF_Nume1,MF_Alfa2,MF_Lista2,MF_Bool5,ID_Relacionado"
        where_fiscal = "ID_Relacionado >= 'I-' AND ID_Relacionado < 'J-' AND MF_Bool5 = 0"
        datos_fiscal = self.repository.ejecutar_consulta(
            token=token,
            select=cols_fiscal,
            table="CONT_Info_Fiscal",
            where=where_fiscal,
            limit=250000
        )
        if not datos_fiscal:
            logging.warning("Service: Información fiscal de compras vacía.")
            return pd.DataFrame()
        df_fiscal = pd.DataFrame(datos_fiscal)
        
        # Validación de columnas de cruce
        if 'VENDOR_ID' not in df_facturas.columns or 'VENDOR_ID' not in df_proveedores.columns:
            logging.error("Service: Faltan llaves de proveedor para realizar el cruce.")
            return pd.DataFrame()
        if 'DOC_ID_CORP' not in df_facturas.columns or 'ID_Relacionado' not in df_fiscal.columns:
            logging.error("Service: Faltan llaves de documento fiscal para realizar el cruce.")
            return pd.DataFrame()
            
        # normalización de llaves para cruces relacionales estables
        df_facturas['VENDOR_ID'] = df_facturas['VENDOR_ID'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
        df_facturas['DOC_ID_CORP'] = df_facturas['DOC_ID_CORP'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
        
        df_proveedores['VENDOR_ID'] = df_proveedores['VENDOR_ID'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
        df_proveedores = df_proveedores.drop_duplicates(subset=['VENDOR_ID'])
        
        df_fiscal['ID_Relacionado'] = df_fiscal['ID_Relacionado'].astype(str).str.replace(r'\.0$', '', regex=True).str.strip().str.upper()
            
        # 4. Cruces relacionales en RAM
        df_cruce = pd.merge(df_facturas, df_proveedores, on='VENDOR_ID', how='inner')
        df_cruce = pd.merge(df_cruce, df_fiscal, left_on='DOC_ID_CORP', right_on='ID_Relacionado', how='inner')
        
        # Helper para interpretar booleanos desde el ERP
        def parse_bool(val):
            if pd.isna(val): return False
            return str(val).strip().lower() in ['true', '1', 't', 'y', 'yes']
            
        # Normalizar booleanos
        if 'CONFIRMED' in df_cruce.columns:
            df_cruce['CONFIRMED_BOOL'] = df_cruce['CONFIRMED'].apply(parse_bool)
        else:
            df_cruce['CONFIRMED_BOOL'] = False
            
        if 'VOID' in df_cruce.columns:
            df_cruce['VOID_BOOL'] = df_cruce['VOID'].apply(parse_bool)
        else:
            df_cruce['VOID_BOOL'] = False
            
        if 'MF_Bool5' in df_cruce.columns:
            df_cruce['MF_Bool5_BOOL'] = df_cruce['MF_Bool5'].apply(parse_bool)
        else:
            df_cruce['MF_Bool5_BOOL'] = False
            
        # Filtrado lógico (Equivalente al WHERE en SQL)
        df_cruce = df_cruce[
            (df_cruce['CONFIRMED_BOOL'] == True) &
            (df_cruce['VOID_BOOL'] == False) &
            (df_cruce['MF_Bool5_BOOL'] == False)
        ]
        
        df_cruce['ES_ANULADO'] = df_cruce['VOID_BOOL'].apply(lambda x: 1 if x else 0)
        
        # Conversión de valores monetarios
        campos_numericos = ['TotalProductosConIVa', 'TotalServiciosConIVa', 'TotalProductosSinIVa', 'TotalServiciosSinIVa', 'INVOICE_TOTAL']
        for col in campos_numericos:
            if col in df_cruce.columns:
                df_cruce[col] = pd.to_numeric(df_cruce[col], errors='coerce').fillna(0)
            else:
                df_cruce[col] = 0.0
                
        # Cálculos de campos derivados
        df_cruce['SUMA_CON_IVA'] = df_cruce['TotalProductosConIVa'] + df_cruce['TotalServiciosConIVa']
        df_cruce['SUMA_SIN_IVA'] = df_cruce['TotalProductosSinIVa'] + df_cruce['TotalServiciosSinIVa']
        
        # Ordenamiento final
        sort_cols = ['MF_Lista2', 'INVOICE_DATE', 'DOC_REFERENCE']
        available_sort_cols = [c for c in sort_cols if c in df_cruce.columns]
        if available_sort_cols:
            df_cruce = df_cruce.sort_values(
                by=available_sort_cols,
                ascending=[True] * len(available_sort_cols)
            )
            
        df_cruce = df_cruce.head(100000)
        
        columnas_finales = [
            "INVOICE_DATE", "CORP", "VENDOR_ID", "VENDOR_NAME", "RUC_or_FED_ID",
            "MEMO", "INVOICE_TOTAL", "DOC_REFERENCE", "MF_Nume1", "MF_Alfa2",
            "MF_Lista2", "SUMA_CON_IVA", "SUMA_SIN_IVA", "ES_ANULADO", "MF_Bool5",
            "DOC_ID_CORP", "ID_Relacionado"
        ]
        
        columnas_disponibles = [col for col in columnas_finales if col in df_cruce.columns]
        df_final = df_cruce[columnas_disponibles]
        
        if not df_final.empty:
            df_final = df_final.apply(lambda x: x.str.strip() if x.dtype == "object" else x)
            
        return df_final
