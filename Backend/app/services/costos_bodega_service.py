import datetime
import logging
import time
from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models.costos_bodega import SCHEMA_COSTOS_BODEGA
from app.repositories.mba3_repository import IMba3Repository

# Reemplaza el armado manual en Excel (VLOOKUP + SUMIF) descrito en
# TAREA-costos-por-sucursal.md: exportar "Saldos y Costos Por Bodega" (~157k
# filas) + "Listado de Bodegas" (~320 filas) a mano, cada vez que alguien
# necesita el costo de inventario por sucursal.
#
# Mismo patron que KpiService/KpiSyncVentas: el reporte (CostosBodegaService)
# SOLO lee el datawarehouse propio en Postgres -- nunca consulta MBA3 en
# vivo. CostosBodegaSyncService es quien habla con MBA3 y llena esas tablas,
# disparado a mano desde /panel/sync (igual que Ventas/Movimientos/KPI).
#
# Se migro de "consultar MBA3 en vivo por request" a este esquema porque en
# PRUEBAS cada pagina corta en 3000 filas ignorando el limit pedido: el pull
# completo tarda 30-45 minutos y excede el timeout por defecto del fetch de
# Next.js/Node (~5 min, error "fetch failed" observado en la pantalla).
#
# 2026-09-15: se agrego el catalogo de productos (INVT_Ficha_Principal) por
# dos motivos: (1) filtrar el reporte por producto/grupo/marca, pedido para
# igualar al libro de Excel que usa Contabilidad; (2) respaldo del costo --
# confirmado contra MBA3 real que en PRUEBAS `Costo_Promedio` de
# INVT_Bodegas_Saldos viene en 0 para TODO NVC01, pero `AVERAGE_COST` de la
# ficha del producto trae el costo real (mismo valor que el desglose interno
# ResumSaldosProductos de MBA3 cuando ese si esta poblado; validado tambien
# contra un export fresco de Contabilidad del 15/09: linea por linea calzan
# al centavo, y el total general coincide con el que trae el propio Excel de
# MBA3 con 0.014% de diferencia, explicable por el desfasaje entre el
# momento de cada export). No es un bug de permisos ni de este codigo: es un
# campo especifico roto en ese ambiente.
#
# 2026-09-16: se agrego CORP como filtro real (NVC01 "Novicompu" / ENV01
# "Env") -- antes solo se sincronizaba NVC01 (via settings.MBA3_CORP). Las
# dos empresas comparten codigos de bodega (ver CostosBodegaBodega), asi que
# CORP entra en la clave de bodegas y en todos los filtros: seleccionar una
# empresa nunca debe mezclar costos de la otra.
#
# 2026-09-16 (2): se agrego la jerarquia "Bodega Principal" -> "Sub-Bodega".
# Antes se agrupaba por Codigo_Sucursal (que en la practica SIEMPRE viene
# vacio de MBA3) cayendo a WARE_NAME/WARE_CODE -- eso mezclaba bodegas
# principales y sub-bodegas en una sola lista plana. El campo correcto para
# agrupar es Codigo_Local (confirmado contra MBA3 real), pero su nombre
# bonito ("001 RIO COCA") no vive en ningun campo consultable del ERP --
# viene del documento manual de Contabilidad (Estructura_Todas_las_Bodegas_
# y_Subbodegas.xlsx), importado una vez a las tablas de referencia
# bodegas_principales/subbodegas_tipo (ver CostosBodegaPrincipal/Subtipo).
# Ese documento es propio de NVC01 (no cubre ENV01): por eso ambas tablas
# tienen `corp` en la clave, y una bodega sin match en el catalogo (ENV01
# entero, o una bodega nueva de NVC01 que el documento todavia no tiene) cae
# a WARE_NAME/su propio codigo como nombre -- nunca desaparece del reporte.
#
# Nota de seguridad: todo lo que se interpola con f-string en las consultas
# SQL de abajo es un identificador fijo del propio codigo (SCHEMA_COSTOS_BODEGA,
# nombre de tabla/columna), nunca un valor de MBA3 o del usuario -- esos
# siempre van como parametro (:nombre) via SQLAlchemy, nunca concatenados al
# texto. Los filtros de `obtener_detalle` arman el WHERE con nombres de
# columna fijos (de una lista blanca) y valores parametrizados.

TABLA_SALDOS = "INVT_Bodegas_Saldos"
TABLA_BODEGAS = "INVT_Bodegas_Lista"
TABLA_PRODUCTOS = "INVT_Ficha_Principal"
CAMPOS_SALDOS = "WARE_CODE,PRODUCT_ID_CORP,OH,Costo_Promedio,Costo_Total_Inventario,AVAILABLE,COMMITED"
CAMPOS_BODEGAS = "WARE_CODE,WARE_NAME,Codigo_Sucursal,Codigo_Local,CITY"
CAMPOS_PRODUCTOS = "PRODUCT_ID_CORP,PRODUCT_NAME,GROUP_CODE,SUB_GROUP_CODE,Codigo_Marca,PRODUCT_TYPE,AVERAGE_COST"
# IndexKey_ProductoBodega es unico por fila (producto+bodega): confirmado
# contra el servidor real que con esta columna la paginacion limit+offset no
# repite ni salta filas. Un orderBy no unico (ej. WARE_CODE) si las corrompe.
ORDEN_SALDOS = "IndexKey_ProductoBodega asc"
# PRODUCT_ID_CORP es la clave primaria de la ficha del producto: unica por
# definicion, misma razon que ORDEN_SALDOS.
ORDEN_PRODUCTOS = "PRODUCT_ID_CORP asc"
# Tamaño de pagina pedido. En PROD el ERP lo respeta (~157k filas / 10000 =
# ~16 peticiones para NVC01). En PRUEBAS corta cada respuesta en 3000 filas
# IGNORANDO este numero -- el codigo de paginacion no asume que lo que
# pidio es lo que recibio, asi que funciona igual en ambos casos, solo que
# en PRUEBAS hacen falta mas peticiones para la misma cantidad de datos.
# No bajar este numero para "hacer mas peticiones mas chicas": el servicio
# vetea la IP por peticiones/segundo, y menos filas por pagina es exactamente
# lo contrario de lo que conviene.
TAMANO_PAGINA = 10000
PAUSA_ENTRE_PAGINAS_SEGUNDOS = 1.5

# Cantidad de filas de cada "Top" (productos/grupos/marcas) que se muestra en
# los graficos apenas se abre el reporte -- no es paginado, solo un vistazo
# rapido, asi que se deja fijo en vez de exponerlo como parametro.
LIMITE_TOP = 15

# Empresas que se sincronizan y se pueden filtrar. Hardcodeado (no en env, a
# diferencia de base_url/credenciales): son las dos empresas reales del
# negocio, no un parametro de despliegue -- mismo patron que
# ventas_service.py (`nombres = {"NVC01": "NOVICOMPU", "ENV01": "ENV"}`).
EMPRESAS = {"NVC01": "Novicompu", "ENV01": "Env"}
CORPS_SOPORTADOS = list(EMPRESAS.keys())

# Columnas por las que se puede filtrar el detalle -- lista blanca fija, para
# no armar el WHERE con nombres de columna que vengan de afuera. Referencian
# los nombres de columna TAL COMO salen del subquery envuelto (SQL_DETALLE_BASE
# esta envuelto en "SELECT * FROM (...) t" -- un alias interno como "p." o
# "s." ya no es visible ahi afuera, solo el nombre de columna proyectado).
FILTROS_DETALLE = {
    "bodega_principal": "bodega_principal_codigo",
    "sub_bodega": "ware_code",
    "grupo": "group_code",
    "marca": "codigo_marca",
    "corp": "corp",
}

SQL_BODEGAS = f"SELECT ware_code, ware_name, codigo_sucursal, codigo_local, ciudad, corp FROM {SCHEMA_COSTOS_BODEGA}.bodegas"
SQL_SALDOS = f"SELECT ware_code, product_id_corp, oh, costo_promedio, corp FROM {SCHEMA_COSTOS_BODEGA}.saldos"
SQL_PRODUCTOS = (f"SELECT product_id_corp, product_name, group_code, sub_group_code, "
                 f"codigo_marca, average_cost FROM {SCHEMA_COSTOS_BODEGA}.productos")
SQL_PRINCIPALES = f"SELECT codigo_local, nombre FROM {SCHEMA_COSTOS_BODEGA}.bodegas_principales WHERE corp = :corp"
SQL_ULTIMA_SYNC = f"SELECT MAX(updated_at) FROM {SCHEMA_COSTOS_BODEGA}.saldos"
SQL_UPSERT_BODEGA = f"""
    INSERT INTO {SCHEMA_COSTOS_BODEGA}.bodegas (ware_code, corp, ware_name, codigo_sucursal, codigo_local, ciudad)
    VALUES (:ware_code, :corp, :ware_name, :codigo_sucursal, :codigo_local, :ciudad)
    ON CONFLICT (ware_code, corp) DO UPDATE SET
        ware_name = EXCLUDED.ware_name, codigo_sucursal = EXCLUDED.codigo_sucursal,
        codigo_local = EXCLUDED.codigo_local, ciudad = EXCLUDED.ciudad, updated_at = NOW()
    WHERE {SCHEMA_COSTOS_BODEGA}.bodegas.ware_name IS DISTINCT FROM EXCLUDED.ware_name
       OR {SCHEMA_COSTOS_BODEGA}.bodegas.codigo_sucursal IS DISTINCT FROM EXCLUDED.codigo_sucursal
       OR {SCHEMA_COSTOS_BODEGA}.bodegas.codigo_local IS DISTINCT FROM EXCLUDED.codigo_local
       OR {SCHEMA_COSTOS_BODEGA}.bodegas.ciudad IS DISTINCT FROM EXCLUDED.ciudad
"""
SQL_UPSERT_PRINCIPAL = f"""
    INSERT INTO {SCHEMA_COSTOS_BODEGA}.bodegas_principales (codigo_local, corp, nombre)
    VALUES (:codigo_local, :corp, :nombre)
    ON CONFLICT (codigo_local, corp) DO UPDATE SET nombre = EXCLUDED.nombre, updated_at = NOW()
"""
SQL_UPSERT_SUBTIPO = f"""
    INSERT INTO {SCHEMA_COSTOS_BODEGA}.subbodegas_tipo (ware_code, corp, tipo)
    VALUES (:ware_code, :corp, :tipo)
    ON CONFLICT (ware_code, corp) DO UPDATE SET tipo = EXCLUDED.tipo, updated_at = NOW()
"""
SQL_UPSERT_SALDO = f"""
    INSERT INTO {SCHEMA_COSTOS_BODEGA}.saldos
        (ware_code, product_id_corp, oh, costo_promedio, corp, updated_at)
    VALUES (:ware_code, :product_id_corp, :oh, :costo_promedio, :corp, NOW())
    ON CONFLICT (ware_code, product_id_corp) DO UPDATE SET
        oh = EXCLUDED.oh, costo_promedio = EXCLUDED.costo_promedio,
        corp = EXCLUDED.corp, updated_at = NOW()
    WHERE {SCHEMA_COSTOS_BODEGA}.saldos.oh IS DISTINCT FROM EXCLUDED.oh
       OR {SCHEMA_COSTOS_BODEGA}.saldos.costo_promedio IS DISTINCT FROM EXCLUDED.costo_promedio
"""
SQL_UPSERT_PRODUCTO = f"""
    INSERT INTO {SCHEMA_COSTOS_BODEGA}.productos
        (product_id_corp, product_name, group_code, sub_group_code, codigo_marca,
         product_type, average_cost, corp, updated_at)
    VALUES (:product_id_corp, :product_name, :group_code, :sub_group_code, :codigo_marca,
            :product_type, :average_cost, :corp, NOW())
    ON CONFLICT (product_id_corp) DO UPDATE SET
        product_name = EXCLUDED.product_name, group_code = EXCLUDED.group_code,
        sub_group_code = EXCLUDED.sub_group_code, codigo_marca = EXCLUDED.codigo_marca,
        product_type = EXCLUDED.product_type, average_cost = EXCLUDED.average_cost,
        corp = EXCLUDED.corp, updated_at = NOW()
    WHERE {SCHEMA_COSTOS_BODEGA}.productos.product_name IS DISTINCT FROM EXCLUDED.product_name
       OR {SCHEMA_COSTOS_BODEGA}.productos.group_code IS DISTINCT FROM EXCLUDED.group_code
       OR {SCHEMA_COSTOS_BODEGA}.productos.sub_group_code IS DISTINCT FROM EXCLUDED.sub_group_code
       OR {SCHEMA_COSTOS_BODEGA}.productos.codigo_marca IS DISTINCT FROM EXCLUDED.codigo_marca
       OR {SCHEMA_COSTOS_BODEGA}.productos.product_type IS DISTINCT FROM EXCLUDED.product_type
       OR {SCHEMA_COSTOS_BODEGA}.productos.average_cost IS DISTINCT FROM EXCLUDED.average_cost
"""
# Barrido SOLO de saldos, y SIEMPRE acotado a `corp = :corp`: un producto que
# se quedo en OH=0 (se vendio/ya no tiene existencia) tiene que salir del
# reporte de costo, o queda plata fantasma -- aprobado explicitamente
# (2026-09-17): "si el stock es 0 o el costo es 0 si puede borrar". Bodegas y
# productos (catalogos) NUNCA se borran por sync -- si MBA3 deja de traer un
# codigo en una corrida puntual (ERP raro, timeout parcial, etc.) no hay que
# perder el catalogo ya conocido; en el peor caso queda una fila vieja sin
# uso, nunca datos borrados de mas.
SQL_BARRIDO_SALDOS = f"DELETE FROM {SCHEMA_COSTOS_BODEGA}.saldos WHERE corp = :corp AND updated_at < :inicio"

# JOIN base del detalle: saldo x bodega (para la sub-bodega y su bodega
# principal) x producto (para nombre/grupo/marca y el respaldo de costo). El
# join a bodegas es por (ware_code, corp) -- por codigo solo, "TRN" de NVC01
# haria join con "TRN" de ENV01 igual de bien, mezclando datos entre
# empresas. LEFT JOIN a productos porque un saldo sin ficha (producto
# borrado del catalogo, dato raro) no debe desaparecer del reporte -- sale
# con nombre/grupo vacios en vez de perderse. LEFT JOIN a bodegas_principales/
# subbodegas_tipo porque esos catalogos son manuales (importados del Excel
# de Contabilidad, solo cubren NVC01 por ahora) -- una bodega sin match
# todavia tiene que aparecer, con su propio codigo/WARE_NAME como nombre.
#
# bodega_principal_codigo = Codigo_Local si la bodega pertenece a una, o su
# propio WARE_CODE si no (TRN, RCP) -- misma logica que
# resolver_bodega_principal_codigo(), pero en SQL para poder filtrar/agrupar
# sin traer todas las filas a Python.
#
# product_id_corp se muestra SIN el sufijo "-NVC01"/"-ENV01": ese sufijo es
# parte de la clave unica que usa MBA3 (necesario para el JOIN, que si usa
# s.product_id_corp completo), pero es redundante como texto -- `corp` ya
# sale como su propia columna. Mostrarlo en el codigo del producto confundia
# (pedido 2026-09-16).
SQL_DETALLE_BASE = f"""
    SELECT
        COALESCE(NULLIF(b.codigo_local, ''), s.ware_code) AS bodega_principal_codigo,
        COALESCE(NULLIF(bp.nombre, ''), NULLIF(b.ware_name, ''),
                 COALESCE(NULLIF(b.codigo_local, ''), s.ware_code)) AS bodega_principal_nombre,
        s.ware_code, NULLIF(b.ware_name, '') AS sub_bodega_nombre, st.tipo AS sub_bodega_tipo,
        regexp_replace(s.product_id_corp, '-' || s.corp || '$', '') AS product_id_corp,
        s.oh, s.costo_promedio, s.corp,
        p.product_name, p.group_code, p.sub_group_code, p.codigo_marca, p.average_cost
    FROM {SCHEMA_COSTOS_BODEGA}.saldos s
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.bodegas b ON b.ware_code = s.ware_code AND b.corp = s.corp
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.bodegas_principales bp ON bp.codigo_local = b.codigo_local AND bp.corp = s.corp
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.subbodegas_tipo st ON st.ware_code = s.ware_code AND st.corp = s.corp
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.productos p ON p.product_id_corp = s.product_id_corp
"""
# DISTINCT ON (no DISTINCT llano) sobre (corp, codigo): mismo motivo que el
# fix de agregar_por_sucursal (2026-09-18) -- sin catalogo (bp.nombre vacio)
# el fallback NULLIF(b.ware_name,'') varia por sub-bodega, y un DISTINCT
# comun habria devuelto una fila por cada WARE_NAME distinto bajo el mismo
# codigo de Bodega Principal (el selector se veria "duplicado"). DISTINCT ON
# se queda con UNA sola fila por (corp, codigo), la de menor WARE_CODE
# (ORDER BY), igual de determinista que _resumen_subbodegas_por_principal.
# Envuelto en un SELECT exterior porque DISTINCT ON exige que el ORDER BY
# empiece con sus propias columnas -- el llamador (obtener_opciones_filtro)
# le agrega su propio WHERE/ORDER BY por fuera, sobre el resultado ya
# deduplicado.
SQL_OPCIONES_PRINCIPALES = f"""
    SELECT codigo, nombre, corp FROM (
        SELECT DISTINCT ON (b.corp, COALESCE(NULLIF(b.codigo_local, ''), b.ware_code))
            COALESCE(NULLIF(b.codigo_local, ''), b.ware_code) AS codigo,
            COALESCE(NULLIF(bp.nombre, ''), NULLIF(b.ware_name, ''),
                     COALESCE(NULLIF(b.codigo_local, ''), b.ware_code)) AS nombre,
            b.corp AS corp
        FROM {SCHEMA_COSTOS_BODEGA}.bodegas b
        LEFT JOIN {SCHEMA_COSTOS_BODEGA}.bodegas_principales bp ON bp.codigo_local = b.codigo_local AND bp.corp = b.corp
        ORDER BY b.corp, COALESCE(NULLIF(b.codigo_local, ''), b.ware_code), b.ware_code
    ) principales
"""
# LEFT JOIN a saldos/productos (no INNER): una sub-bodega sin stock actual
# (OH=0 en todas sus filas, o sin filas) igual tiene que aparecer en el
# desglose -- con costo_total en 0, no desaparecida. COALESCE por fuera del
# SUM (no dentro) porque el LEFT JOIN puede no traer NINGUNA fila de saldos
# para esa sub-bodega, y SUM() de cero filas da NULL, no 0.
SQL_OPCIONES_SUBBODEGAS = f"""
    SELECT b.ware_code, NULLIF(b.ware_name, '') AS ware_name, st.tipo,
        COALESCE(SUM(ROUND((CASE WHEN s.costo_promedio > 0 THEN s.costo_promedio
                                  ELSE COALESCE(p.average_cost, 0) END) * s.oh, 2)), 0) AS costo_total
    FROM {SCHEMA_COSTOS_BODEGA}.bodegas b
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.subbodegas_tipo st ON st.ware_code = b.ware_code AND st.corp = b.corp
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.saldos s ON s.ware_code = b.ware_code AND s.corp = b.corp
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.productos p ON p.product_id_corp = s.product_id_corp
    WHERE b.corp = :corp AND COALESCE(NULLIF(b.codigo_local, ''), b.ware_code) = :bodega_principal
    GROUP BY b.ware_code, b.ware_name, st.tipo
    ORDER BY costo_total DESC, ware_name NULLS LAST, b.ware_code
"""

# "Top" para los graficos que se ven apenas se abre el reporte (Top Productos/
# Grupos/Marcas por costo). A diferencia de agregar_por_sucursal() (que agrega
# en Python, ver comentario ahi sobre por que), aca SI se agrega en SQL: a
# diferencia de WARE_CODE, un PRODUCT_ID_CORP/group_code/codigo_marca
# repetido entre NVC01 y ENV01 significa lo mismo (mismo producto/categoria
# de catalogo, no dos bodegas fisicas distintas que no deben mezclarse) --
# sumar sin filtro de corp es exactamente el total combinado que se espera
# ver en "Todas las empresas". El costo efectivo (bodega, o el del producto
# si aquel vino en 0) y su redondeo van igual que en Python: ROUND() de
# Postgres sobre NUMERIC redondea igual que ROUND_HALF_UP (no banker's
# rounding), asi que hacerlo en SQL no cambia el resultado.
SQL_TOP_PRODUCTOS = f"""
    SELECT
        regexp_replace(s.product_id_corp, '-' || s.corp || '$', '') AS codigo,
        p.product_name,
        SUM(ROUND((CASE WHEN s.costo_promedio > 0 THEN s.costo_promedio
                         ELSE COALESCE(p.average_cost, 0) END) * s.oh, 2)) AS costo_total
    FROM {SCHEMA_COSTOS_BODEGA}.saldos s
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.productos p ON p.product_id_corp = s.product_id_corp
"""
SQL_TOP_GRUPOS = f"""
    SELECT p.group_code AS etiqueta,
        SUM(ROUND((CASE WHEN s.costo_promedio > 0 THEN s.costo_promedio
                         ELSE COALESCE(p.average_cost, 0) END) * s.oh, 2)) AS costo_total
    FROM {SCHEMA_COSTOS_BODEGA}.saldos s
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.productos p ON p.product_id_corp = s.product_id_corp
    WHERE p.group_code IS NOT NULL AND p.group_code <> ''
"""
SQL_TOP_MARCAS = f"""
    SELECT p.codigo_marca AS etiqueta,
        SUM(ROUND((CASE WHEN s.costo_promedio > 0 THEN s.costo_promedio
                         ELSE COALESCE(p.average_cost, 0) END) * s.oh, 2)) AS costo_total
    FROM {SCHEMA_COSTOS_BODEGA}.saldos s
    LEFT JOIN {SCHEMA_COSTOS_BODEGA}.productos p ON p.product_id_corp = s.product_id_corp
    WHERE p.codigo_marca IS NOT NULL AND p.codigo_marca <> ''
"""


def _codigo(valor) -> str:
    """Normaliza cualquier codigo (de bodega o de sucursal) a texto.

    Bodegas como 145/184/187 pueden llegar como int en el JSON del ERP, no
    como str. Un `.strip()` directo sobre un int revienta con AttributeError.
    """
    return str(valor if valor is not None else "").strip()


def _normalizar_codigo_local(valor) -> str:
    """Normaliza Codigo_Local para que calce entre MBA3 en vivo y el catalogo
    manual (bodegas_principales, importado del Excel de Contabilidad).

    Confirmado contra MBA3 real (2026-09-16): en vivo viene con ceros a la
    izquierda ("002", "010"), pero el Excel de Contabilidad los omite ("2",
    "10") -- de 197 codigos de NVC01, solo 99 calzaban tal cual antes de este
    fix, dejando a la mitad de las Bodegas Principales sin su nombre del
    catalogo (caian al fallback de WARE_NAME/codigo). Se aplica tanto al
    sincronizar bodegas desde MBA3 como al importar el catalogo, para que
    ninguno de los dos lados dependa de tener el padding correcto de origen.
    Codigos no numericos (PRI, POT) quedan intactos.
    """
    c = _codigo(valor)
    return c.lstrip("0") or c if c.isdigit() else c


def resolver_costo_promedio(costo_promedio_saldo, average_cost_producto):
    """Costo unitario efectivo de una linea: prioriza el de la bodega, y cae
    al de la ficha del producto si viene en 0.

    Confirmado contra MBA3 real: en PRUEBAS, Costo_Promedio de
    INVT_Bodegas_Saldos viene en 0 para todo NVC01, pero AVERAGE_COST de
    INVT_Ficha_Principal trae el costo real del mismo producto. Se usa el de
    la bodega primero porque en un ambiente sano (PROD, o PRUEBAS arreglado)
    es el mas especifico; 0 se interpreta como "no calculado", no como "vale
    cero de verdad" -- un producto con costo real cero es un caso de borde
    que este reporte no distingue, igual que el Excel manual tampoco lo hacia.
    """
    cp = float(costo_promedio_saldo or 0)
    if cp:
        return costo_promedio_saldo
    return average_cost_producto or 0


def _costo_linea(costo_promedio, oh) -> Decimal:
    """Costo de UNA linea saldo, redondeado antes de acumular.

    `round()` nativo de Python usa banker's rounding y da resultados
    distintos a Excel/MBA3 (ambos con ROUND_HALF_UP): round(2.255, 2) da 2.25
    en Python contra 2.26 en MBA3/Excel. Sobre ~157k filas la diferencia es
    material si se redondea el total en vez de cada linea.

    Se convierte via `str(...)` y no pasando el float directo a Decimal:
    Decimal(2.255) arrastra el error de representacion binaria del float
    (2.25499999999999989...) y redondearia para el lado equivocado.
    """
    cp = Decimal(str(costo_promedio if costo_promedio is not None else 0))
    cantidad = Decimal(str(oh if oh is not None else 0))
    return (cp * cantidad).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def resolver_bodega_principal_codigo(codigo_local, ware_code) -> str:
    """Codigo de agrupacion de "Bodega Principal" para una bodega (sub-bodega).

    Es Codigo_Local si la bodega pertenece a una (la inmensa mayoria: MBA3
    trae esta relacion en vivo). Las bodegas TRN (Transito) y RCP (Proveedor)
    no tienen Codigo_Local -- se tratan como su propia "bodega principal" de
    una sola sub-bodega (ellas mismas), igual que el reporte manual las
    trataba antes de que existiera esta jerarquia. Sin esto el total no
    cuadra (Transito solo son ~504.000 USD, segun TAREA-costos-por-sucursal.md).
    """
    cl = _codigo(codigo_local)
    return cl if cl else _codigo(ware_code)


def resolver_bodega_principal_nombre(codigo_principal, nombre_catalogo, ware_name) -> str:
    """Nombre a mostrar de una bodega principal.

    El nombre bonito ("001 RIO COCA") NO vive en ningun campo consultable de
    MBA3 -- viene del catalogo manual `bodegas_principales`, importado del
    Excel de Contabilidad (propio de NVC01). Sin match en ese catalogo
    (ENV01 completo, o una bodega nueva de NVC01 que el Excel todavia no
    tiene), se cae a WARE_NAME y despues al propio codigo, para no perder la
    fila en silencio -- mismo criterio que el resto del reporte.
    """
    nombre = _codigo(nombre_catalogo)
    if nombre:
        return nombre
    wn = _codigo(ware_name)
    return wn if wn else codigo_principal


def agregar_por_sucursal(filas_saldo: Iterable[dict], bodegas: Dict[str, dict],
                         productos: Optional[Dict[str, dict]] = None) -> Dict[str, Decimal]:
    """Suma el costo de inventario (costo efectivo * OH) por Bodega Principal.

    No depende de ningun cliente HTTP: `filas_saldo` es cualquier iterable de
    dicts con las llaves WARE_CODE/PRODUCT_ID_CORP/Costo_Promedio/OH (tal
    como los devuelve MBA3), `bodegas` es el catalogo indexado por WARE_CODE
    normalizado (ya acotado a UNA empresa por el llamador -- esta funcion no
    sabe de CORP, mezclar bodegas de dos empresas en un solo dict produciria
    colisiones si comparten WARE_CODE), `productos` (opcional) el catalogo
    indexado por PRODUCT_ID_CORP normalizado -- se usa solo como respaldo del
    costo (ver resolver_costo_promedio). Asi se puede testear contra
    fixtures, sin tocar la red, y es lo mismo que usan tanto el sync
    (fixtures/tests) como el reporte (filas de Postgres formateadas con las
    mismas llaves).

    La llave del resultado es SOLO el codigo_principal (Codigo_Local, o el
    propio WARE_CODE si no tiene) -- NUNCA el nombre resuelto. Antes se
    agrupaba por (codigo, nombre) y el nombre, sin match en el catalogo
    manual, caia al WARE_NAME de CADA fila -- distinto por sub-bodega. Eso
    partia una misma Bodega Principal en tantas filas fantasma como
    WARE_NAME distintos tuvieran sus sub-bodegas, cada una sumando solo una
    fraccion del costo real (bug confirmado en produccion 2026-09-18: la
    bodega principal "27" -- 22 sub-bodegas con stock -- se partio en varias
    filas, mostrando a Gerencia $2.24M en vez de los $4.62M reales). El
    nombre a mostrar se resuelve aparte, una sola vez por codigo_principal,
    en CostosBodegaService._resumen_subbodegas_por_principal.
    """
    productos = productos or {}
    totales: Dict[str, Decimal] = defaultdict(lambda: Decimal("0.00"))
    for fila in filas_saldo:
        ware_code = _codigo(fila.get("WARE_CODE"))
        bodega = bodegas.get(ware_code, {})
        codigo_principal = resolver_bodega_principal_codigo(bodega.get("codigo_local"), ware_code)
        producto = productos.get(_codigo(fila.get("PRODUCT_ID_CORP")), {})
        costo_efectivo = resolver_costo_promedio(fila.get("Costo_Promedio"), producto.get("average_cost"))
        totales[codigo_principal] += _costo_linea(costo_efectivo, fila.get("OH"))
    return dict(totales)


class CostosBodegaService:
    """Costo de inventario por sucursal/producto, leido del datawarehouse
    propio (schema `costos_bodega` en Postgres).

    NUNCA consulta MBA3: eso es trabajo de CostosBodegaSyncService. Sin datos
    sincronizados todavia, devuelve el reporte vacio (no es un error).
    """

    def __init__(self, db: Session):
        self.db = db

    def _cargar_bodegas(self, corp: Optional[str] = None) -> Dict[str, dict]:
        sql = SQL_BODEGAS + (" WHERE corp = :corp" if corp else "")
        filas = self.db.execute(text(sql), {"corp": corp} if corp else {}).mappings().all()
        # Sin filtro de corp, WARE_CODE puede repetirse entre empresas (ver
        # modelo): la ultima fila leida gana. Por eso esta funcion SOLO se usa
        # ya acotada a una empresa -- obtener_costos_por_sucursal itera
        # CORPS_SOPORTADOS y llama esto una vez por empresa (ver mas abajo),
        # nunca sin corp.
        return {
            _codigo(b["ware_code"]): {"codigo_local": b["codigo_local"], "ware_name": b["ware_name"],
                                       "ciudad": b["ciudad"]}
            for b in filas
        }

    def _cargar_principales(self, corp: str) -> Dict[str, str]:
        """Catalogo Codigo_Local -> nombre de Bodega Principal, de UNA
        empresa (el Excel fuente es propio de NVC01; para ENV01 devuelve
        vacio y el reporte cae a WARE_NAME/codigo, ver resolver_bodega_
        principal_nombre)."""
        filas = self.db.execute(text(SQL_PRINCIPALES), {"corp": corp}).mappings().all()
        return {_codigo(p["codigo_local"]): p["nombre"] for p in filas}

    @staticmethod
    def _resumen_subbodegas_por_principal(bodegas: Dict[str, dict],
                                          principales: Optional[Dict[str, str]] = None) -> Dict[str, dict]:
        """Para cada Bodega Principal (por codigo), cuenta cuantas sub-bodegas
        (WARE_CODE) tiene registradas en el catalogo -- TODAS, tengan o no
        stock actual, es un dato estructural -- resuelve una ciudad
        representativa (la primera no vacia entre sus sub-bodegas: CITY de
        MBA3 viene muy disperso, ~5% de las bodegas de NVC01 lo tienen
        cargado) y resuelve el NOMBRE a mostrar, UNA SOLA VEZ por
        codigo_principal.

        El nombre se resuelve aca (no por fila de saldo, ver agregar_por_
        sucursal) precisamente para que sea el mismo sin importar cual
        sub-bodega se mire: `bodegas` se recorre en orden fijo (WARE_CODE
        ordenado) y el nombre se fija con la PRIMERA sub-bodega de cada
        grupo -- determinista aunque el catalogo manual (`principales`) no
        tenga esa Bodega Principal todavia (entonces cae al WARE_NAME de esa
        primera sub-bodega en vez de al de cualquiera)."""
        principales = principales or {}
        resumen: Dict[str, dict] = {}
        for ware_code in sorted(bodegas.keys()):
            info = bodegas[ware_code]
            codigo_principal = resolver_bodega_principal_codigo(info.get("codigo_local"), ware_code)
            entry = resumen.setdefault(codigo_principal, {"total_subbodegas": 0, "ciudad": None, "nombre": None})
            entry["total_subbodegas"] += 1
            if not entry["ciudad"]:
                ciudad = _codigo(info.get("ciudad"))
                if ciudad:
                    entry["ciudad"] = ciudad
            if not entry["nombre"]:
                entry["nombre"] = resolver_bodega_principal_nombre(
                    codigo_principal, principales.get(codigo_principal), info.get("ware_name")
                )
        return resumen

    def _cargar_productos(self) -> Dict[str, dict]:
        # PRODUCT_ID_CORP ya trae el sufijo de empresa (ver modelo): no hace
        # falta filtrar por corp aca, cada producto es de una sola empresa.
        filas = self.db.execute(text(SQL_PRODUCTOS)).mappings().all()
        return {
            _codigo(p["product_id_corp"]): {
                "product_name": p["product_name"], "group_code": p["group_code"],
                "sub_group_code": p["sub_group_code"], "codigo_marca": p["codigo_marca"],
                "average_cost": p["average_cost"],
            }
            for p in filas
        }

    def obtener_costos_por_sucursal(self, corp: Optional[str] = None) -> dict:
        """Costo total por Bodega Principal (agrupa sus sub-bodegas).

        Itera empresa por empresa (una sola si se filtro `corp`, las dos
        soportadas si no) y SUMA los totales parciales -- nunca junta las
        bodegas de dos empresas en un solo dict antes de agregar. Si se
        hiciera eso, un WARE_CODE compartido entre NVC01 y ENV01 (TRN, RCP)
        pisaria silenciosamente el nombre/costo de una empresa con el de la
        otra en la vista "todas las empresas".
        """
        productos = self._cargar_productos()  # PRODUCT_ID_CORP ya trae el sufijo de empresa, es global.
        # Llave (corp, codigo_principal) -- el nombre NO entra en la llave de
        # agregacion (ver agregar_por_sucursal y _resumen_subbodegas_por_
        # principal): se resuelve aparte, una sola vez por codigo, y se
        # adjunta recien al armar `sucursales` mas abajo. `corp`/`codigo`
        # hacen falta para que el front pueda pedir el desglose por
        # sub-bodega de una fila puntual (GET /subbodegas).
        totales: Dict[Tuple[str, str], Decimal] = defaultdict(lambda: Decimal("0.00"))
        # (corp, codigo_principal) -> {total_subbodegas, ciudad, nombre} --
        # estructural en su mayor parte (no depende de los saldos: una
        # principal sin stock actual igual tiene sub-bodegas registradas),
        # salvo `nombre` que si se usa para mostrar el total de esta llave.
        metadata: Dict[Tuple[str, str], dict] = {}
        filas_procesadas = 0
        for c in ([corp] if corp else CORPS_SOPORTADOS):
            bodegas = self._cargar_bodegas(c)
            principales = self._cargar_principales(c)
            for codigo_principal, info in self._resumen_subbodegas_por_principal(bodegas, principales).items():
                metadata[(c, codigo_principal)] = info
            saldos_filas = self.db.execute(text(SQL_SALDOS + " WHERE corp = :corp"), {"corp": c}).mappings().all()
            # Mismas llaves que espera agregar_por_sucursal (las de MBA3): asi
            # el calculo es identico sin importar si las filas vienen de
            # Postgres o de un fixture de test.
            filas = [{"WARE_CODE": f["ware_code"], "PRODUCT_ID_CORP": f["product_id_corp"],
                      "OH": f["oh"], "Costo_Promedio": f["costo_promedio"]}
                     for f in saldos_filas]
            parciales = agregar_por_sucursal(filas, bodegas, productos)
            for codigo, costo in parciales.items():
                totales[(c, codigo)] += costo
            filas_procesadas += len(filas)

        sucursales = []
        for (c, codigo), costo in totales.items():
            meta = metadata.get((c, codigo), {})
            nombre = meta.get("nombre") or codigo
            sucursales.append({
                "sucursal": nombre, "codigo": codigo, "corp": c, "costo_total": float(costo),
                "total_subbodegas": meta.get("total_subbodegas", 0),
                "ciudad": meta.get("ciudad"),
            })
        sucursales.sort(key=lambda s: s["sucursal"])
        total_general = sum(totales.values(), Decimal("0.00"))

        ultima_sync = self.db.execute(text(SQL_ULTIMA_SYNC)).scalar()

        return {
            "sucursales": sucursales,
            "total_general": float(total_general),
            "filas_procesadas": filas_procesadas,
            "ultima_sincronizacion": ultima_sync.isoformat() if ultima_sync else None,
            "top_productos": self._top_productos(corp),
            "top_grupos": self._top(SQL_TOP_GRUPOS, corp),
            "top_marcas": self._top(SQL_TOP_MARCAS, corp),
        }

    def _top_productos(self, corp: Optional[str]) -> List[dict]:
        sql = (SQL_TOP_PRODUCTOS + (" WHERE s.corp = :corp" if corp else "") +
              " GROUP BY s.product_id_corp, s.corp, p.product_name ORDER BY costo_total DESC LIMIT :limite")
        params = {"limite": LIMITE_TOP}
        if corp:
            params["corp"] = corp
        filas = self.db.execute(text(sql), params).mappings().all()
        return [{"etiqueta": f["product_name"] or f["codigo"], "costo_total": float(f["costo_total"] or 0)}
                for f in filas]

    def _top(self, sql_base: str, corp: Optional[str]) -> List[dict]:
        """Top por grupo o marca -- ambas consultas ya traen su propio WHERE
        (columna no vacia), asi que el filtro de empresa se agrega con AND."""
        sql = (sql_base + (" AND s.corp = :corp" if corp else "") +
              " GROUP BY etiqueta ORDER BY costo_total DESC LIMIT :limite")
        params = {"limite": LIMITE_TOP}
        if corp:
            params["corp"] = corp
        filas = self.db.execute(text(sql), params).mappings().all()
        return [{"etiqueta": f["etiqueta"], "costo_total": float(f["costo_total"] or 0)} for f in filas]

    def obtener_empresas(self) -> List[dict]:
        return [{"corp": c, "nombre": n} for c, n in EMPRESAS.items()]

    def obtener_opciones_filtro(self, corp: Optional[str] = None) -> dict:
        """Valores distintos para armar los selectores de filtro del detalle,
        acotados a `corp` si se indica -- las bodegas de una empresa no
        deben aparecer como opcion al filtrar la otra.

        Devuelve la lista de Bodegas Principales (codigo + nombre resuelto,
        para el primer selector); las sub-bodegas de una principal puntual se
        piden aparte via obtener_subbodegas() (dependen de cual principal se
        eligio primero)."""
        params = {"corp": corp} if corp else {}
        # "corp" (no "b.corp"): SQL_OPCIONES_PRINCIPALES ahora envuelve la
        # deduplicacion (DISTINCT ON) en un SELECT exterior sin alias "b",
        # este WHERE/ORDER BY se le pega afuera de ese SELECT.
        where_bodegas = " WHERE corp = :corp" if corp else ""
        principales = self.db.execute(text(
            f"{SQL_OPCIONES_PRINCIPALES}{where_bodegas} ORDER BY 2"
        ), params).mappings().all()
        # `corp` va en cada opcion (no solo en la respuesta general) porque sin
        # filtro de empresa (`corp` de esta funcion es None) dos empresas
        # podrian, en teoria, compartir el mismo codigo de Bodega Principal
        # (igual que TRN/RCP a nivel de WARE_CODE) -- el codigo solo no
        # alcanza para identificar una fila de forma univoca en ese caso. El
        # front usa este `corp` (no el filtro global de empresa) para pedir
        # sub-bodegas y filtrar el detalle una vez elegida la principal.
        bodegas_principales = [{"codigo": p["codigo"], "nombre": p["nombre"], "corp": p["corp"]} for p in principales]

        # Grupo/marca viven en `productos`, que no tiene corp propio (el
        # sufijo de PRODUCT_ID_CORP ya lo distingue) -- se acotan por corp
        # cruzando contra los saldos de esa empresa.
        if corp:
            grupos = self.db.execute(text(f"""
                SELECT DISTINCT p.group_code FROM {SCHEMA_COSTOS_BODEGA}.productos p
                JOIN {SCHEMA_COSTOS_BODEGA}.saldos s ON s.product_id_corp = p.product_id_corp
                WHERE s.corp = :corp AND p.group_code IS NOT NULL AND p.group_code <> '' ORDER BY 1
            """), params).scalars().all()
            marcas = self.db.execute(text(f"""
                SELECT DISTINCT p.codigo_marca FROM {SCHEMA_COSTOS_BODEGA}.productos p
                JOIN {SCHEMA_COSTOS_BODEGA}.saldos s ON s.product_id_corp = p.product_id_corp
                WHERE s.corp = :corp AND p.codigo_marca IS NOT NULL AND p.codigo_marca <> '' ORDER BY 1
            """), params).scalars().all()
        else:
            grupos = self.db.execute(text(
                f"SELECT DISTINCT group_code FROM {SCHEMA_COSTOS_BODEGA}.productos "
                f"WHERE group_code IS NOT NULL AND group_code <> '' ORDER BY 1"
            )).scalars().all()
            marcas = self.db.execute(text(
                f"SELECT DISTINCT codigo_marca FROM {SCHEMA_COSTOS_BODEGA}.productos "
                f"WHERE codigo_marca IS NOT NULL AND codigo_marca <> '' ORDER BY 1"
            )).scalars().all()

        return {"bodegas_principales": bodegas_principales, "grupos": list(grupos), "marcas": list(marcas)}

    def obtener_subbodegas(self, corp: str, bodega_principal: str) -> List[dict]:
        """Sub-bodegas (WARE_CODE) de una Bodega Principal puntual, para el
        segundo selector -- solo tiene sentido pedirlo despues de elegir
        `corp` y la principal en el primer selector (obtener_opciones_filtro).
        `bodega_principal` es el CODIGO (Codigo_Local, o el propio WARE_CODE
        para TRN/RCP), no el nombre -- el mismo valor que devuelve
        obtener_opciones_filtro en `codigo`."""
        filas = self.db.execute(text(SQL_OPCIONES_SUBBODEGAS),
                                {"corp": corp, "bodega_principal": bodega_principal}).mappings().all()
        return [{"ware_code": f["ware_code"], "nombre": f["ware_name"], "tipo": f["tipo"],
                "costo_total": float(f["costo_total"] or 0)} for f in filas]

    def obtener_detalle(self, corp: Optional[str] = None, bodega_principal: Optional[str] = None,
                        sub_bodega: Optional[str] = None, grupo: Optional[str] = None,
                        marca: Optional[str] = None, q: Optional[str] = None,
                        limit: int = 100, offset: int = 0) -> dict:
        """Detalle linea por linea (bodega x producto), con filtros -- el
        equivalente a la hoja cruda del libro de Excel, pero ya cruzada.

        `corp`/`grupo`/`marca` filtran por igualdad exacta (valores de
        obtener_opciones_filtro/obtener_empresas). `bodega_principal` filtra
        por el CODIGO de la principal (de obtener_opciones_filtro) y agrupa
        TODAS sus sub-bodegas; `sub_bodega` acota ademas a un WARE_CODE
        puntual dentro de esa principal (de obtener_subbodegas) -- pasar
        `sub_bodega` sin `bodega_principal` tambien funciona (WARE_CODE ya es
        univoco dentro de una empresa). `q` busca por substring en el codigo
        o nombre del producto. Paginado con limit/offset: puede haber ~157k
        lineas, no se manda todo de una vez ni al backend ni al navegador.
        """
        condiciones = []
        params: dict = {}
        if corp:
            condiciones.append(f"{FILTROS_DETALLE['corp']} = :corp")
            params["corp"] = corp
        if bodega_principal:
            condiciones.append(f"{FILTROS_DETALLE['bodega_principal']} = :bodega_principal")
            params["bodega_principal"] = bodega_principal
        if sub_bodega:
            condiciones.append(f"{FILTROS_DETALLE['sub_bodega']} = :sub_bodega")
            params["sub_bodega"] = sub_bodega
        if grupo:
            condiciones.append(f"{FILTROS_DETALLE['grupo']} = :grupo")
            params["grupo"] = grupo
        if marca:
            condiciones.append(f"{FILTROS_DETALLE['marca']} = :marca")
            params["marca"] = marca
        if q:
            condiciones.append("(product_id_corp ILIKE :q OR product_name ILIKE :q)")
            params["q"] = f"%{q}%"

        # Varios filtros (bodega_principal, sub_bodega_tipo, etc.) usan
        # columnas calculadas con COALESCE, asi que no se puede filtrar en el
        # WHERE del SELECT base directo -- se envuelve en un subquery para
        # poder referenciar esos alias por su nombre proyectado.
        sql_filtrado = f"SELECT * FROM ({SQL_DETALLE_BASE}) t"
        where = f" WHERE {' AND '.join(condiciones)}" if condiciones else ""

        total = self.db.execute(text(f"SELECT COUNT(*) FROM ({sql_filtrado}{where}) c"), params).scalar()

        params_pag = {**params, "limit": limit, "offset": offset}
        filas = self.db.execute(text(
            f"{sql_filtrado}{where} ORDER BY bodega_principal_nombre, ware_code, product_id_corp "
            f"LIMIT :limit OFFSET :offset"
        ), params_pag).mappings().all()

        lineas = []
        for f in filas:
            costo_efectivo = resolver_costo_promedio(f["costo_promedio"], f["average_cost"])
            lineas.append({
                "corp": f["corp"], "bodega_principal": f["bodega_principal_nombre"],
                "ware_code": f["ware_code"], "sub_bodega_nombre": f["sub_bodega_nombre"],
                "sub_bodega_tipo": f["sub_bodega_tipo"],
                "product_id_corp": f["product_id_corp"], "producto_nombre": f["product_name"],
                "grupo": f["group_code"], "subgrupo": f["sub_group_code"], "marca": f["codigo_marca"],
                "oh": float(f["oh"] or 0), "costo_unitario": float(costo_efectivo or 0),
                "costo_total": float(_costo_linea(costo_efectivo, f["oh"])),
            })

        return {"lineas": lineas, "total_filas": int(total or 0), "limit": limit, "offset": offset}


class CostosBodegaSyncService:
    """Sincroniza bodegas, productos y saldos de MBA3 hacia el datawarehouse
    propio, para una o mas empresas (CORPS_SOPORTADOS por defecto).

    Separado de CostosBodegaService (que solo lee Postgres) porque este SI
    habla con MBA3 -- mismo patron que KpiService/KpiSyncVentas. Se llama
    desde /panel/sync, nunca desde la vista del reporte.
    """

    def __init__(self, repository: IMba3Repository):
        self.repository = repository

    def sincronizar(self, db: Session, env: Optional[str] = None,
                    corps: Optional[List[str]] = None) -> dict:
        resultado = {}
        for corp in (corps or CORPS_SOPORTADOS):
            resultado[corp] = {
                "bodegas": self._sincronizar_bodegas(db, env, corp),
                "productos": self._sincronizar_productos(db, env, corp),
                "saldos": self._sincronizar_saldos(db, env, corp),
            }
        return resultado

    @staticmethod
    def _contar_cambiadas(db: Session, tabla: str, corp: str, inicio: "datetime.datetime") -> int:
        """Cuantas filas de `tabla` (acotado a `corp`) quedaron con
        updated_at >= inicio -- gracias al WHERE ... IS DISTINCT FROM de cada
        UPSERT (ver SQL_UPSERT_*), eso son exactamente las filas nuevas o
        realmente modificadas en esta corrida, nunca las que se reescribieron
        con el mismo valor que ya tenian. Un SELECT COUNT aparte, no
        RETURNING: con executemany (una lista de filas en un solo execute)
        RETURNING no es confiable entre drivers, un COUNT si.
        """
        return db.execute(
            text(f"SELECT COUNT(*) FROM {SCHEMA_COSTOS_BODEGA}.{tabla} WHERE corp = :corp AND updated_at >= :inicio"),
            {"corp": corp, "inicio": inicio},
        ).scalar() or 0

    def _sincronizar_bodegas(self, db: Session, env: Optional[str], corp: str) -> dict:
        """Catalogo bodega -> sucursal para UNA empresa.

        NO se filtra por INACTIVE: hay bodegas cerradas que todavia tienen
        stock y si cuentan para el total (aclarado explicitamente en la
        tarea: filtrar por INACTIVE descuadra el reporte). NUNCA se borra
        (ver comentario en SQL_BARRIDO_SALDOS) -- solo upsert, y el upsert es
        un no-op real (no reescribe updated_at) si nada cambio, gracias al
        WHERE IS DISTINCT FROM de SQL_UPSERT_BODEGA.
        """
        inicio_sync = datetime.datetime.utcnow()
        token = self.repository.obtener_token(env=env)
        if not token:
            raise ValueError("No se pudo autenticar contra MBA3 (revisar credenciales/entorno).")
        filas = self.repository.ejecutar_consulta(
            token=token, select=CAMPOS_BODEGAS, table=TABLA_BODEGAS,
            where=f"CORP='{corp}'", limit=1000, env=env,
        )
        if filas is None:
            raise ValueError(f"El ERP no respondio al pedir bodegas ({corp}).")

        lote = [
            {"ware_code": _codigo(f.get("WARE_CODE")), "ware_name": f.get("WARE_NAME"),
             "codigo_sucursal": f.get("Codigo_Sucursal"),
             "codigo_local": _normalizar_codigo_local(f.get("Codigo_Local")) or None,
             "ciudad": f.get("CITY"), "corp": corp}
            for f in filas if _codigo(f.get("WARE_CODE"))
        ]
        if lote:
            db.execute(text(SQL_UPSERT_BODEGA), lote)
            db.commit()
        cambiadas = self._contar_cambiadas(db, "bodegas", corp, inicio_sync)
        return {"vistas": len(lote), "cambiadas": cambiadas}

    def _sincronizar_productos(self, db: Session, env: Optional[str], corp: str) -> dict:
        """Catalogo de productos (INVT_Ficha_Principal) de UNA empresa,
        paginado igual que los saldos: mismo tope de 3000 en PRUEBAS, mismo
        riesgo de token vencido a mitad de camino. A diferencia de saldos,
        NUNCA se borra (aprobado explicitamente 2026-09-17): un producto que
        MBA3 no devolvio en esta corrida puntual (timeout parcial, pagina
        rara) no debe perder su ficha ya conocida -- en el peor caso queda
        una fila vieja sin uso, nunca datos de mas borrados.
        """
        inicio_sync = datetime.datetime.utcnow()
        total = 0
        offset = 0
        while True:
            token = self.repository.obtener_token(env=env)
            if not token:
                raise ValueError("No se pudo autenticar contra MBA3 (revisar credenciales/entorno).")
            pagina = self.repository.ejecutar_consulta(
                token=token, select=CAMPOS_PRODUCTOS, table=TABLA_PRODUCTOS,
                where=f"CORP='{corp}'",
                order_by=ORDEN_PRODUCTOS, limit=TAMANO_PAGINA, offset=offset, env=env,
            )
            if pagina is None:
                raise ValueError(f"El ERP no respondio al pedir productos ({corp}, offset={offset}).")
            if not pagina:
                break

            lote = [
                {"product_id_corp": _codigo(f.get("PRODUCT_ID_CORP")),
                 "product_name": f.get("PRODUCT_NAME"), "group_code": f.get("GROUP_CODE"),
                 "sub_group_code": f.get("SUB_GROUP_CODE"), "codigo_marca": f.get("Codigo_Marca"),
                 "product_type": f.get("PRODUCT_TYPE"), "average_cost": f.get("AVERAGE_COST") or 0,
                 "corp": corp}
                for f in pagina if _codigo(f.get("PRODUCT_ID_CORP"))
            ]
            if lote:
                db.execute(text(SQL_UPSERT_PRODUCTO), lote)
                db.commit()

            total += len(pagina)
            offset += len(pagina)
            logging.info(f"CostosBodegaSyncService: pagina de productos ({corp}) trajo {len(pagina)} filas "
                         f"(acumulado {total}, siguiente offset={offset}).")
            time.sleep(PAUSA_ENTRE_PAGINAS_SEGUNDOS)

        cambiadas = self._contar_cambiadas(db, "productos", corp, inicio_sync)
        return {"vistas": total, "cambiadas": cambiadas}

    def _sincronizar_saldos(self, db: Session, env: Optional[str], corp: str) -> dict:
        """Trae TODOS los saldos con OH>0 de UNA empresa, paginando por
        limit+offset, y los guarda en Postgres.

        Se detiene SOLO cuando una pagina vuelve vacia -- nunca por "vino
        menos de lo pedido". El ERP de PRUEBAS corta en 3000 filas IGNORANDO
        el limit (PROD si lo respeta): con limit=10000, una pagina de
        PRUEBAS vuelve con 3000 filas, que es MENOS que TAMANO_PAGINA sin
        ser la ultima pagina. Cortar ahi dejaria la sincronizacion corta en
        silencio. El offset avanza por la cantidad de filas REALMENTE
        recibida, no por TAMANO_PAGINA, por la misma razon.

        El token se pide de nuevo ANTES de cada pagina: con ~50+ paginas la
        sync puede tardar varios minutos y el JWT vence a mitad de camino.

        No se hace DELETE + INSERT: se UPSERTa fila por fila con
        updated_at=NOW(), y al final se borra lo que quedo con updated_at
        viejo PARA ESTA EMPRESA (no se toco en esta corrida => ya no tiene
        OH>0 en MBA3). Si la sync se corta a la mitad por una falla del ERP,
        esto deja al reporte con datos de la sync anterior en las paginas no
        alcanzadas, nunca con la tabla vacia a medio camino.
        """
        inicio_sync = datetime.datetime.utcnow()
        total = 0
        offset = 0
        while True:
            token = self.repository.obtener_token(env=env)
            if not token:
                raise ValueError("No se pudo autenticar contra MBA3 (revisar credenciales/entorno).")
            pagina = self.repository.ejecutar_consulta(
                token=token, select=CAMPOS_SALDOS, table=TABLA_SALDOS,
                where=f"CORP='{corp}' AND OH>0",
                order_by=ORDEN_SALDOS, limit=TAMANO_PAGINA, offset=offset, env=env,
            )
            if pagina is None:
                raise ValueError(f"El ERP no respondio al pedir saldos ({corp}, offset={offset}).")
            if not pagina:
                break

            lote = [
                {"ware_code": _codigo(f.get("WARE_CODE")),
                 "product_id_corp": str(f.get("PRODUCT_ID_CORP") or "").strip(),
                 "oh": f.get("OH") or 0, "costo_promedio": f.get("Costo_Promedio") or 0,
                 "corp": corp}
                for f in pagina if _codigo(f.get("WARE_CODE"))
            ]
            if lote:
                db.execute(text(SQL_UPSERT_SALDO), lote)
                db.commit()

            total += len(pagina)
            offset += len(pagina)
            logging.info(f"CostosBodegaSyncService: pagina ({corp}) trajo {len(pagina)} filas "
                         f"(acumulado {total}, siguiente offset={offset}).")
            time.sleep(PAUSA_ENTRE_PAGINAS_SEGUNDOS)

        cambiadas = self._contar_cambiadas(db, "saldos", corp, inicio_sync)

        # Barrido: lo que no se toco en esta corrida ya no tiene OH>0 en MBA3
        # (se vendio todo o dejo de existir) y tiene que salir del reporte --
        # unico borrado aprobado (stock/costo en 0), acotado a esta empresa
        # para no tocar filas de la otra. DELETE de una sola sentencia (no
        # executemany), rowcount aca SI es confiable.
        eliminadas = db.execute(text(SQL_BARRIDO_SALDOS), {"corp": corp, "inicio": inicio_sync}).rowcount
        db.commit()
        return {"vistas": total, "cambiadas": cambiadas, "eliminadas": eliminadas}


def importar_estructura_bodegas(db: Session, filas: Iterable[dict], corp: str) -> dict:
    """Carga (o actualiza) el catalogo manual Codigo_Local -> Bodega Principal
    y WARE_CODE -> Tipo/Clasificacion, desde filas ya parseadas (no toca
    ningun archivo -- eso es responsabilidad del llamador, ver
    Backend/scripts/seed_bodegas_principales.py).

    NO viene de MBA3: es el documento manual que arma Contabilidad (hoy
    "Listado Completo (Matriz)" de Estructura_Todas_las_Bodegas_y_Subbodegas.xlsx,
    propio de NVC01). `corp` es explicito (no viene en las filas) porque ese
    documento fuente no distingue empresa -- quien llama a esta funcion sabe
    a que empresa corresponde el archivo que esta importando.

    Cada fila espera las llaves `codigo_local`, `nombre_principal`,
    `ware_code`, `tipo` (las que ya usa scripts/seed_data/bodegas_principales_
    nvc01.json). Una fila sin `codigo_local` (TRN/RCP: no pertenecen a
    ninguna bodega principal) se ignora para el catalogo de principales, pero
    su `tipo` SI se guarda si vino.
    """
    principales, subtipos = {}, []
    for f in filas:
        # Normalizado igual que en el sync (ver _normalizar_codigo_local): el
        # Excel de Contabilidad omite ceros a la izquierda, MBA3 en vivo no.
        codigo_local = _normalizar_codigo_local(f.get("codigo_local"))
        nombre = _codigo(f.get("nombre_principal"))
        if codigo_local and nombre:
            principales[codigo_local] = nombre
        ware_code = _codigo(f.get("ware_code"))
        tipo = _codigo(f.get("tipo"))
        if ware_code and tipo:
            subtipos.append({"ware_code": ware_code, "corp": corp, "tipo": tipo})

    lote_principales = [{"codigo_local": c, "corp": corp, "nombre": n} for c, n in principales.items()]
    if lote_principales:
        db.execute(text(SQL_UPSERT_PRINCIPAL), lote_principales)
    if subtipos:
        db.execute(text(SQL_UPSERT_SUBTIPO), subtipos)
    db.commit()
    return {"corp": corp, "bodegas_principales": len(lote_principales), "subbodegas_tipo": len(subtipos)}
