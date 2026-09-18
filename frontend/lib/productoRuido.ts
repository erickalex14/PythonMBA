// Mismo criterio que Backend/app/services/ventas_service.py::PATRONES_PRODUCTO_RUIDO
// (unica fuente de verdad de ese lado -- si se agrega un patron aca, agregarlo
// tambien alla). Globos, fundas, servicios y bolsas de despacho (Novoa)
// ensucian los rankings por producto -- salen en cantidades enormes o montos
// irrisorios y tapan a los productos que de verdad interesan. Se compara
// contra el nombre en mayusculas, asi que "GLOBO" atrapa tambien
// "PORTAGLOBOS" e "INFLAGLOBOS", y "NOVOA" atrapa cualquier talla de
// "IMPORTADORA NOVOA".
//
// Usar SOLO para filtrar tops/rankings por producto en el front (Estadisticas
// de Ventas, Rentabilidad, ATS, Movimientos, Liquidaciones, Dashboard...) --
// nunca para descontar montos de un total (eso ya lo hace el backend, con su
// propia lista PATRONES_CONSUMIBLE, mas angosta: no saca "SERVICIO" porque
// los servicios si son venta real).
export const PATRONES_PRODUCTO_RUIDO = ["GLOBO", "FUNDA", "SERVICIO", "NOVOA"] as const;

export function esProductoRuido(nombre: unknown): boolean {
  const texto = String(nombre ?? "").toUpperCase();
  return PATRONES_PRODUCTO_RUIDO.some((patron) => texto.includes(patron));
}
