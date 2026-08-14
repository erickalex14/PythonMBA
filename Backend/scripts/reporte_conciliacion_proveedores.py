"""
Reporte: facturas recibidas conciliadas con transferencias bancarias.
Cruce PROV_Factura_Principal + PROV_Ficha_Principal + PROV_Cobros_Cuotas.

Credenciales del servicio ERP por env: ERP_TEST_CODIGO / ERP_TEST_PASSWORD.
Rango por env opcional: FECHA_DESDE / FECHA_HASTA (default mayo-julio 2026).
"""
import sys
import os
import requests
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.config import settings
from app.repositories.mba3_repository import procesar_respuesta_erp

FECHA_DESDE = os.environ.get("FECHA_DESDE", "2026-05-01")
FECHA_HASTA = os.environ.get("FECHA_HASTA", "2026-07-31")
BASE_URL = settings.MBA3_BASE_URL_TEST

# AMOUNT_TAX2 = IVA real (Monto_Impuesto_1 viene siempre en 0).
# Subtotal se deriva como INVOICE_TOTAL - AMOUNT_TAX2: los campos de subtotal del ERP
# estan repartidos en 6 columnas (gravado/cero/exento/no objeto x producto/servicio) y
# se solapan entre si, restar el impuesto al total evita el doble conteo.
COLS_FACTURA = ("DOC_ID_CORP,DOC_REFERENCE,INVOICE_DATE,VENDOR_ID_CORP,MEMO,INVOICE_TOTAL,"
                "AMOUNT_TAX2,AMOUNT_RETENTIO,AMOUNT_PAY_TOT,AMOUNT_PAID,BALANCE,"
                "Factura_xml_autorizacion,RETENTION_CODE,VOID")
COLS_FICHA = "CODIGO_PROVEEDOR_EMPRESA,VENDOR_NAME,RUC_or_FED_ID,VENDOR_TYPE"
COLS_COBROS = ("VEND_INV_REF,PAYMENT_DATE,CHECK_NUMBER,PAYMENT_NUM,PAYMENT_AMOUNT,"
               "RETENTION_AMNT,TYPE,ORIGIN")


def login():
    r = requests.post(
        f"{BASE_URL}/ws2_mba3_serv_/login_servicio",
        json={"codigo": os.environ["ERP_TEST_CODIGO"], "pwd": os.environ["ERP_TEST_PASSWORD"]},
        headers={"Content-Type": "application/json"},
        timeout=15,
    )
    r.raise_for_status()
    token = r.json().get("jwt")
    if not token:
        raise RuntimeError(f"Login sin jwt: {r.json()}")
    return token


def consultar(token, select, table, where=None, limit=50000):
    payload = {"select": select, "from": table, "limit": str(limit)}
    if where:
        payload["where"] = where
    r = requests.post(
        f"{BASE_URL}/ws2_mba3_serv_Consultas_Externas_/",
        headers={"Authorization": token},
        data=payload,
        timeout=300,
    )
    r.raise_for_status()
    return procesar_respuesta_erp(r.json(), f"tabla {table}")


def norm(serie):
    """Normaliza llaves de cruce: quita .0 de floats, espacios, mayusculas."""
    return serie.astype(str).str.replace(r"\.0$", "", regex=True).str.strip().str.upper()


def num(serie):
    return pd.to_numeric(serie, errors="coerce").fillna(0.0)


def tipo_contribuyente(ruc):
    """
    Deriva tipo de contribuyente del RUC ecuatoriano (3er digito).
    ponytail: heuristica SRI estandar; si el ERP expone el campo real, usar ese.
    """
    ruc = str(ruc).strip()
    if len(ruc) < 3 or not ruc[:3].isdigit():
        return "Desconocido"
    tercero = ruc[2]
    if tercero == "9":
        return "Sociedad privada"
    if tercero == "6":
        return "Sector publico"
    if tercero.isdigit() and int(tercero) < 6:
        return "Persona natural"
    return "Desconocido"


def main():
    token = login()
    print(f"Login OK. Rango {FECHA_DESDE} a {FECHA_HASTA}")

    facturas = consultar(token, COLS_FACTURA, "PROV_Factura_Principal",
                         f"INVOICE_DATE >= '{FECHA_DESDE}' AND INVOICE_DATE <= '{FECHA_HASTA}'")
    print(f"Facturas: {len(facturas)}")
    if not facturas:
        print("Sin facturas en el rango, nada que reportar.")
        return

    proveedores = consultar(token, COLS_FICHA, "PROV_Ficha_Principal", limit=100000)
    print(f"Proveedores (catalogo): {len(proveedores)}")

    # Pagos: rango amplio (un pago puede ocurrir despues del cierre del rango de factura)
    cobros = consultar(token, COLS_COBROS, "PROV_Cobros_Cuotas",
                       f"PAYMENT_DATE >= '{FECHA_DESDE}'")
    print(f"Pagos/cobros: {len(cobros)}")

    df_f = pd.DataFrame(facturas)
    df_p = pd.DataFrame(proveedores)
    df_c = pd.DataFrame(cobros) if cobros else pd.DataFrame(columns=COLS_COBROS.split(","))

    # Excluir facturas anuladas
    if "VOID" in df_f.columns:
        anuladas = df_f["VOID"].astype(str).str.strip().str.lower().isin(["true", "1", "t", "s", "si", "y"])
        print(f"Facturas anuladas excluidas: {int(anuladas.sum())}")
        df_f = df_f[~anuladas]

    # Cruce proveedor -> RUC
    df_f["_vend"] = norm(df_f["VENDOR_ID_CORP"])
    df_p["_vend"] = norm(df_p["CODIGO_PROVEEDOR_EMPRESA"])
    df_p = df_p.drop_duplicates(subset=["_vend"])
    df = df_f.merge(df_p, on="_vend", how="left")

    # Cruce factura -> pago (solo TYPE 'P' = pago real; 'D' son notas de credito)
    df["_ref"] = norm(df["DOC_REFERENCE"])
    if not df_c.empty:
        df_c = df_c[df_c["TYPE"].astype(str).str.strip().str.upper() == "P"].copy()
        df_c["_ref"] = norm(df_c["VEND_INV_REF"])
        # Un pago por factura: si hay varios, se toma el ultimo por fecha
        df_c = df_c.sort_values("PAYMENT_DATE").drop_duplicates(subset=["_ref"], keep="last")
        df = df.merge(df_c, on="_ref", how="left", suffixes=("", "_pago"))
    else:
        for c in ["PAYMENT_DATE", "CHECK_NUMBER", "PAYMENT_AMOUNT", "ORIGIN", "RETENTION_AMNT"]:
            df[c] = None

    tiene_pago = df["PAYMENT_DATE"].notna()
    print(f"Facturas con pago cruzado: {int(tiene_pago.sum())} de {len(df)}")

    total = num(df.get("INVOICE_TOTAL", 0))
    iva = num(df.get("AMOUNT_TAX2", 0))
    subtotal = total - iva
    electronica = df["Factura_xml_autorizacion"].notna() & (
        df["Factura_xml_autorizacion"].astype(str).str.strip() != "")

    salida = pd.DataFrame({
        "N. de factura": df["DOC_REFERENCE"],
        "Fecha de factura": df["INVOICE_DATE"],
        "Cedula/RUC": df.get("RUC_or_FED_ID"),
        "Proveedor": df.get("VENDOR_NAME"),
        "Tipo de contribuyente": df.get("RUC_or_FED_ID", pd.Series(dtype=str)).apply(tipo_contribuyente),
        "Tipo de facturacion": electronica.map({True: "Electronica", False: "Manual"}),
        "Subtotal": subtotal,
        "IVA": iva,
        "Total de la factura": total,
        "Retenciones en la fuente": num(df.get("AMOUNT_RETENTIO", 0)),
        "N. comprobante de retencion": df.get("RETENTION_CODE"),
        "Valor neto a pagar": num(df.get("AMOUNT_PAY_TOT", 0)),
        "Fecha de transferencia": df.get("PAYMENT_DATE"),
        "N. referencia transferencia": df.get("CHECK_NUMBER"),
        "Banco / cuenta origen (codigo)": df.get("ORIGIN"),
        "Valor pagado": num(df.get("PAYMENT_AMOUNT", 0)),
        "Saldo pendiente": num(df.get("BALANCE", 0)),
        "Estado de conciliacion": tiene_pago.map({True: "Conciliado", False: "No conciliado"}),
    })
    salida = salida.sort_values(["Fecha de factura", "N. de factura"])

    # Check de cuadre: subtotal+IVA debe dar el total, y total-retencion el neto a pagar.
    desc_total = (salida["Subtotal"] + salida["IVA"] - salida["Total de la factura"]).abs()
    desc_neto = (salida["Total de la factura"] - salida["Retenciones en la fuente"]
                 - salida["Valor neto a pagar"]).abs()
    print(f"Descuadre subtotal+IVA vs total: max {desc_total.max():.2f}, filas>0.01: {(desc_total > 0.01).sum()}")
    print(f"Descuadre total-retencion vs neto: max {desc_neto.max():.2f}, filas>0.01: {(desc_neto > 0.01).sum()}")
    assert desc_total.max() < 0.01, "Subtotal+IVA no cuadra con el total de la factura"

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reporte_conciliacion.xlsx")
    salida.to_excel(out, index=False, sheet_name="Conciliacion")
    print(f"Filas en reporte: {len(salida)}")
    print(f"Conciliadas: {int(tiene_pago.sum())} | No conciliadas: {int((~tiene_pago).sum())}")
    print(f"Excel guardado: {out}")


if __name__ == "__main__":
    main()
