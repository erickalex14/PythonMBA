// Mapeo Codigo_Marca (Movimientos) -> nombre real de marca, construido a partir
// de muestras reales de PRODUCT_NAME por cada código (no son adivinanzas).
export const MARCA_LABELS: Record<string, string> = {
  ENVI: "ENV",
  ENV: "ENV",
  XIA: "Xiaomi",
  SAMS: "Samsung",
  MOT: "Motorola",
  INF: "Infinix",
  HONOR: "Honor",
  EPSON: "Epson",
  HP: "HP",
  DELL: "Dell",
  ASUS: "Asus",
  LENO: "Lenovo",
  MSI: "MSI",
  TCL: "TCL",
  LG: "LG",
  AOC: "AOC",
  SONY: "Sony",
  NOKIA: "Nokia",
  APPL: "Apple",
  GOOG: "Google",
  MSOFT: "Microsoft",
  AMAZ: "Amazon",
  JBL: "JBL",
  ITEL: "Itel",
  TEC: "Tecno",
  BLU: "BLU",
  BLACK: "Blackview",
  DOOG: "Doogee",
  CHUW: "Chuwi",
  UMI: "Umidigi",
  IPRO: "iPro",
  REME: "Realme",
  ZTE: "ZTE",
  QCY: "QCY",
  HAVI: "Havit",
  HAY: "Haylou",
  AMAF: "Amazfit",
  JED: "Jedel",
  LIDN: "LDNIO",
  TPLI: "TP-Link",
  MERCU: "Mercusys",
  EZVI: "Ezviz",
  KING: "Kingston",
  SAND: "SanDisk",
  ADAT: "ADATA",
  SGATA: "Seagate",
  WD: "WD",
  TOSH: "Toshiba",
  MITS: "Mitsubishi",
  PHILI: "Philips",
  BRE: "Brentwood",
  ROKU: "Roku",
  ONN: "onn",
  VIDV: "Vidvie",
  WESD: "Wesdar",
  Zitro: "Zitro",
  MIGGO: "Miggo",
  COBY: "Coby",
};

// Códigos que en la muestra real no corresponden a una marca consistente
// (productos completamente distintos entre sí bajo el mismo código) - se
// excluyen de "Top Marcas" para no mostrar un dato inventado/incorrecto.
export const MARCA_EXCLUDE = new Set(["SM", "ONE", "KIS", "SING", "CAME"]);

export function getMarcaLabel(code: string): string {
  const trimmed = code.trim();
  return MARCA_LABELS[trimmed] || trimmed;
}
