// Deriva la marca a partir del texto real del producto (Ventas: campo
// `producto`). Se probó primero extraer la marca desde el campo `codigo`
// (misma idea que empresa.ts), pero el código no tiene una estructura fija
// entre productos: para "SERVICIO TECNICO" daba "RTEC", para "TENSIOMETRO
// DIGITAL" daba "NSIOMETRO" - basura. Buscar la marca como palabra dentro
// del nombre real del producto es más lento por fila pero no inventa datos:
// si ninguna palabra conocida aparece, el producto simplemente no se cuenta
// en Top Marcas en vez de quedar mal etiquetado.
//
// Orden: más específico primero (ej. "REDMI" antes que nada ambiguo).
const MARCA_KEYWORDS: [string, string][] = [
  ["XIAOMI", "Xiaomi"],
  ["REDMI", "Xiaomi"],
  ["SAMSUNG", "Samsung"],
  ["MOTOROLA", "Motorola"],
  ["INFINIX", "Infinix"],
  ["HONOR", "Honor"],
  ["EPSON", "Epson"],
  ["LENOVO", "Lenovo"],
  ["ASUS", "Asus"],
  ["DELL", "Dell"],
  ["ACER", "Acer"],
  ["HAVIT", "Havit"],
  ["LDNIO", "LDNIO"],
  ["APPLE", "Apple"],
  ["IPHONE", "Apple"],
  ["AMAZON", "Amazon"],
  ["TP-LINK", "TP-Link"],
  ["TPLINK", "TP-Link"],
  ["ITEL", "Itel"],
  ["KINGSTON", "Kingston"],
  ["JBL", "JBL"],
  ["CANON", "Canon"],
  ["ZITRO", "Zitro"],
  ["NOKIA", "Nokia"],
  ["SONY", "Sony"],
  ["REALME", "Realme"],
  ["BLACKVIEW", "Blackview"],
  ["DOOGEE", "Doogee"],
  ["CHUWI", "Chuwi"],
  ["UMIDIGI", "Umidigi"],
  ["MICROSOFT", "Microsoft"],
  ["GOOGLE", "Google"],
  ["MERCUSYS", "Mercusys"],
  ["EZVIZ", "Ezviz"],
  ["SANDISK", "SanDisk"],
  ["ADATA", "ADATA"],
  ["SEAGATE", "Seagate"],
  ["TOSHIBA", "Toshiba"],
  ["HAYLOU", "Haylou"],
  ["AMAZFIT", "Amazfit"],
  ["PHILIPS", "Philips"],
  ["ROKU", "Roku"],
  ["VIDVIE", "Vidvie"],
  ["WESDAR", "Wesdar"],
  ["QCY", "QCY"],
  ["HP ", "HP"],
  ["TCL", "TCL"],
  ["MSI", "MSI"],
  ["AOC", "AOC"],
  ["LG ", "LG"],
  ["BLU ", "BLU"],
  ["ENV ", "ENV"],
];

export function getMarcaFromProductName(productName: string | undefined | null): string | null {
  if (!productName) return null;
  const upper = ` ${String(productName).toUpperCase()} `;
  for (const [keyword, label] of MARCA_KEYWORDS) {
    if (upper.includes(keyword)) return label;
  }
  return null;
}
