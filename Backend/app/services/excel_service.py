import io
import re
import pandas as pd
from openpyxl.styles import Font, PatternFill, Alignment
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
