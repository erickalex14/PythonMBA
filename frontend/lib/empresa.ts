export const EMPRESA_LABELS: Record<string, string> = {
  NVC01: "Novicompu",
  ENV01: "ENV Accesorios y Sistemas",
};

export function getEmpresaCode(codigo: string | undefined | null): string {
  if (!codigo) return "";
  const parts = String(codigo).split("-");
  return parts[parts.length - 1].trim();
}

export function getEmpresaLabel(codigo: string | undefined | null): string {
  const code = getEmpresaCode(codigo);
  return EMPRESA_LABELS[code] || code || "Sin empresa";
}
