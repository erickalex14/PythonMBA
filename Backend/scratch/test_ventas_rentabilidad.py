"""Self-check: formulas de costo/utilidad deben reproducir rentabilidad.xlsx (factura 17001000045250)."""

precio_venta = 1385.22
cantidad = 1
net_line_total = 1385.22
trans_cost = 719.758  # TRANS_COST real del ERP, confirmado via probe

costo_unitario = round(trans_cost, 4)
costo_total = round(trans_cost * cantidad, 4)
utilidad_unidad = round(precio_venta - trans_cost, 4)
utilidad_total = round(net_line_total - costo_total, 4)
pct_utilidad_neto = round(utilidad_total / net_line_total * 100, 2)
pct_utilidad_costo = round(utilidad_total / costo_total * 100, 2)

assert round(costo_total, 2) == 719.76, costo_total
assert round(utilidad_total, 2) == 665.46, utilidad_total
assert pct_utilidad_neto == 48.04, pct_utilidad_neto
assert pct_utilidad_costo == 92.46, pct_utilidad_costo

print("OK: formulas de rentabilidad calzan con el reporte MBA de referencia.")
