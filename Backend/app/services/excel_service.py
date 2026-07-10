import io
import re
import pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

class ExcelService:
    """
    Servicio de Utilidad para la Generación de Archivos Excel.
    Se encarga de sanitizar los datos para evitar que caracteres extraños rompan el motor xml
    y da formato corporativo a los reportes en memoria.
    """
    
    def generar_reporte_excel(self, df: pd.DataFrame, sheet_name: str) -> io.BytesIO:
        """
        Genera un archivo de Excel en memoria con formato corporativo a partir de un DataFrame,
        aplicando limpieza extrema a los campos de texto.
        """
        # Clonar DataFrame para no alterar los datos en memoria compartida
        df_datos = df.copy()
        
        # Expresión regular para eliminar caracteres de control que rompen openpyxl/Excel XML
        ILLEGAL_CHARACTERS_RE = re.compile(r'[\000-\010]|[\013-\014]|[\016-\037]')
        
        def sanitizar_excel(valor):
            if pd.isna(valor):
                return valor
            val_str = str(valor).strip()
            # Quitar caracteres invisibles/de control
            val_str = ILLEGAL_CHARACTERS_RE.sub("", val_str)
            # Truncar por límite estricto de Excel de 32,767 caracteres por celda
            if len(val_str) > 32700:
                return val_str[:32700] + "... [TRUNCADO POR LIMITE DE EXCEL]"
            return val_str
            
        # Aplicar limpieza unicamente a columnas de texto (object)
        for col in df_datos.select_dtypes(include=['object']).columns:
            df_datos[col] = df_datos[col].apply(sanitizar_excel)
            
        output = io.BytesIO()
        
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_datos.to_excel(writer, index=False, sheet_name=sheet_name)
            worksheet = writer.sheets[sheet_name]
            
            # Estilos corporativos (Azul oscuro con texto blanco y negrita)
            fill_encabezado = PatternFill(start_color="002060", end_color="002060", fill_type="solid")
            fuente_encabezado = Font(color="FFFFFF", bold=True)
            alineacion_centrada = Alignment(horizontal="center", vertical="center")
            
            # Aplicar estilos a la cabecera
            for col_num in range(1, len(df_datos.columns) + 1):
                celda = worksheet.cell(row=1, column=col_num)
                celda.fill = fill_encabezado
                celda.font = fuente_encabezado
                celda.alignment = alineacion_centrada
                
            # Ajuste dinámico del ancho de columnas (límite máximo de 40)
            for idx, col_name in enumerate(df_datos.columns):
                ancho_calculado = max(
                    df_datos[col_name].astype(str).map(len).max(),
                    len(str(col_name))
                ) + 3
                ancho_final = min(ancho_calculado, 40)
                letra_columna = get_column_letter(idx + 1)
                worksheet.column_dimensions[letra_columna].width = ancho_final
                
            # Congelar fila de cabecera y habilitar filtros automáticos
            worksheet.freeze_panes = "A2"
            worksheet.auto_filter.ref = worksheet.dimensions
            
        output.seek(0)
        return output

    def generar_reporte_ventas(self, df: pd.DataFrame, inicio: str, fin: str) -> io.BytesIO:
        """
        Genera el Excel de Ventas replicando (y mejorando) el formato del MBA:
        encabezado corporativo, rango de fechas, resumen por empresa/mayoristas,
        detalle por línea de factura y fila de TOTALES.
        """
        ILLEGAL = re.compile(r'[\000-\010]|[\013-\014]|[\016-\037]')

        def clean(v):
            if pd.isna(v):
                return ""
            s = str(v).strip()
            s = ILLEGAL.sub("", s)
            return s[:32700]

        df = df.copy()

        # Normalizar claves: el GET manda "# de factura"/"TOTAL LINEA"; el POST
        # (datos filtrados del front) manda factura_final/total_linea. Unificar.
        rename_dto = {
            "factura_final": "# de factura",
            "fecha": "FECHA",
            "empresa": "EMPRESA",
            "sucursal": "SUCURSAL",
            "codigo": "CODIGO",
            "producto": "PRODUCTO",
            "grupo": "GRUPO",
            "subgrupo": "SUBGRUPO",
            "unidad": "UNIDAD",
            "cantidad": "CANTIDAD",
            "precio_venta": "PRECIO VENTA",
            "subtotal": "SUBTOTAL (C*PV)",
            "descuento_aplicado": "DESCUENTO APLICADO",
            "total_linea": "TOTAL LINEA",
            "bodega": "BODEGA",
            "bodega_nombre": "BODEGA NOMBRE",
            "codigo_cliente": "CODIGO CLIENTE",
            "nombre_cliente": "NOMBRE CLIENTE",
            "costo_unitario": "COSTO UNITARIO",
            "costo_total": "COSTO TOTAL",
            "utilidad_unidad": "UTILIDAD UNIDAD",
            "utilidad_total": "UTILIDAD TOTAL",
            "pct_utilidad_neto": "% UTILIDAD/NETO",
            "pct_utilidad_costo": "% UTILIDAD/COSTO",
        }
        df = df.rename(columns={k: v for k, v in rename_dto.items() if k in df.columns})

        # Orden y etiquetas de columnas del detalle (igual al MBA)
        columnas = [
            ("# de factura", "# de factura"),
            ("FECHA", "Fecha"),
            ("EMPRESA", "Empresa"),
            ("SUCURSAL", "Sucursal"),
            ("CODIGO", "Código"),
            ("PRODUCTO", "Producto"),
            ("GRUPO", "Grupo"),
            ("SUBGRUPO", "Subgrupo"),
            ("UNIDAD", "Unidad"),
            ("CANTIDAD", "Cantidad"),
            ("PRECIO VENTA", "Precio Venta"),
            ("SUBTOTAL (C*PV)", "SubTotal (C*PV)"),
            ("DESCUENTO APLICADO", "Descuento Aplicado"),
            ("TOTAL LINEA", "Total Linea"),
            ("BODEGA", "Bodega"),
            ("BODEGA NOMBRE", "Bodega Nombre"),
            ("CODIGO CLIENTE", "Código Cliente"),
            ("NOMBRE CLIENTE", "Nombre Cliente"),
            ("COSTO UNITARIO", "Costo Unitario"),
            ("COSTO TOTAL", "Costo Total"),
            ("UTILIDAD UNIDAD", "Utilidad Unidad"),
            ("UTILIDAD TOTAL", "Utilidad Total"),
            ("% UTILIDAD/NETO", "% Utilidad/Neto"),
            ("% UTILIDAD/COSTO", "% Utilidad/Costo"),
        ]
        cols_presentes = [(src, lbl) for src, lbl in columnas if src in df.columns]

        def num(col):
            return pd.to_numeric(df[col], errors='coerce').fillna(0) if col in df.columns else pd.Series([0] * len(df))

        total_general = float(num("TOTAL LINEA").sum())
        total_cant = float(num("CANTIDAD").sum())
        emp_series = df["EMPRESA"].astype(str) if "EMPRESA" in df.columns else pd.Series([""] * len(df))
        suc_series = df["SUCURSAL"].astype(str) if "SUCURSAL" in df.columns else pd.Series([""] * len(df))
        tl = num("TOTAL LINEA")
        total_novi = float(tl[emp_series.str.upper().str.contains("NOVI")].sum())
        total_env = float(tl[emp_series.str.upper().str.contains("ENV")].sum())
        total_may = float(tl[suc_series.isin(["026", "027"])].sum())

        output = io.BytesIO()
        wb = None
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            # Hoja detalle vacía; escribimos manualmente para controlar el encabezado
            ws = writer.book.create_sheet("Detalle Productos - Periodo")
            if "Sheet" in writer.book.sheetnames:
                del writer.book["Sheet"]

            azul = PatternFill(start_color="002060", end_color="002060", fill_type="solid")
            gris = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
            verde = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")
            blanco_bold = Font(color="FFFFFF", bold=True)
            bold = Font(bold=True)
            centro = Alignment(horizontal="center", vertical="center")
            borde = Border(bottom=Side(style="thin", color="B0B0B0"))

            ncols = len(cols_presentes)

            # --- Encabezado corporativo ---
            ws.cell(row=1, column=1, value="NOVISOLUTIONS CIA. LTDA.").font = Font(bold=True, size=14, color="002060")
            ws.cell(row=2, column=1, value="Reporte de Ventas - Detalle Productos por Período").font = Font(bold=True, size=11)
            ws.cell(row=3, column=1, value=f"Rango: {inicio}  al  {fin}").font = Font(italic=True, color="555555")

            # --- Resumen por segmento ---
            resumen = [
                ("TOTAL VENTAS (ENV + Novicompu)", total_general),
                ("Novicompu", total_novi),
                ("ENV", total_env),
                ("Mayoristas (suc. 026 + 027)", total_may),
                ("Unidades vendidas", total_cant),
            ]
            r = 5
            for etq, val in resumen:
                c1 = ws.cell(row=r, column=1, value=etq)
                c1.font = bold
                c1.fill = verde
                c2 = ws.cell(row=r, column=2, value=round(val, 2))
                c2.font = bold
                c2.fill = verde
                c2.number_format = '#,##0.00'
                r += 1

            # --- Cabecera de la tabla ---
            hdr_row = r + 1
            for j, (src, lbl) in enumerate(cols_presentes, start=1):
                cel = ws.cell(row=hdr_row, column=j, value=lbl)
                cel.fill = azul
                cel.font = blanco_bold
                cel.alignment = centro

            # --- Filas de detalle ---
            money_cols = {"PRECIO VENTA", "SUBTOTAL (C*PV)", "DESCUENTO APLICADO", "TOTAL LINEA",
                          "COSTO UNITARIO", "COSTO TOTAL", "UTILIDAD UNIDAD", "UTILIDAD TOTAL"}
            pct_cols = {"% UTILIDAD/NETO", "% UTILIDAD/COSTO"}
            data_start = hdr_row + 1
            rr = data_start
            for _, fila in df.iterrows():
                for j, (src, lbl) in enumerate(cols_presentes, start=1):
                    val = fila.get(src)
                    if src in money_cols or src == "CANTIDAD" or src in pct_cols:
                        try:
                            val = float(val)
                        except Exception:
                            val = 0
                        cel = ws.cell(row=rr, column=j, value=val)
                        cel.number_format = '#,##0.00' if (src in money_cols or src in pct_cols) else '#,##0'
                    else:
                        cel = ws.cell(row=rr, column=j, value=clean(val))
                    cel.border = borde
                rr += 1

            # --- Fila de TOTALES ---
            tot_row = rr
            ws.cell(row=tot_row, column=1, value=f"TOTALES - {len(df)} líneas").font = bold
            for j, (src, lbl) in enumerate(cols_presentes, start=1):
                if src == "CANTIDAD":
                    c = ws.cell(row=tot_row, column=j, value=total_cant)
                    c.number_format = '#,##0'; c.font = bold; c.fill = gris
                elif src == "TOTAL LINEA":
                    c = ws.cell(row=tot_row, column=j, value=round(total_general, 2))
                    c.number_format = '#,##0.00'; c.font = bold; c.fill = gris
                elif src == "SUBTOTAL (C*PV)":
                    c = ws.cell(row=tot_row, column=j, value=round(float(num("SUBTOTAL (C*PV)").sum()), 2))
                    c.number_format = '#,##0.00'; c.font = bold; c.fill = gris
                elif src == "DESCUENTO APLICADO":
                    c = ws.cell(row=tot_row, column=j, value=round(float(num("DESCUENTO APLICADO").sum()), 2))
                    c.number_format = '#,##0.00'; c.font = bold; c.fill = gris
                elif src in ("COSTO TOTAL", "UTILIDAD TOTAL"):
                    c = ws.cell(row=tot_row, column=j, value=round(float(num(src).sum()), 2))
                    c.number_format = '#,##0.00'; c.font = bold; c.fill = gris
                else:
                    ws.cell(row=tot_row, column=j).fill = gris

            # Anchos de columna
            anchos = {"# de factura": 18, "PRODUCTO": 38, "CODIGO": 16, "GRUPO": 10,
                      "SUBGRUPO": 10, "EMPRESA": 12, "SUCURSAL": 10, "FECHA": 12,
                      "BODEGA NOMBRE": 22, "NOMBRE CLIENTE": 28}
            for j, (src, lbl) in enumerate(cols_presentes, start=1):
                ws.column_dimensions[get_column_letter(j)].width = anchos.get(src, 14)

            ws.freeze_panes = ws.cell(row=data_start, column=1)

        output.seek(0)
        return output
