import React from "react";
import { ReportConfig } from "../lib/reports-config";
import { Badge } from "./ui/Badge";

interface ReportTableProps {
  config: ReportConfig;
  paginatedData: any[];
  styles: any;
}

export const ReportTable: React.FC<ReportTableProps> = ({ config, paginatedData, styles }) => {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {config.columns.map((col) => (
            <th key={col.key}>{col.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((row, idx) => (
          <tr key={idx}>
            {config.columns.map((col) => {
              const val = row[col.key];
              // null/undefined es "no se sabe" y se pinta "—"; un 0 real sigue
              // saliendo como 0. Importa: cuando el ERP no responde, el stock
              // llega en null, y mostrarlo como "0" se leeria como "no hay
              // stock" — una afirmacion que nadie verifico.
              const sinDato = val === null || val === undefined || val === "";

              if (col.type === "currency") {
                return (
                  <td key={col.key}>
                    {sinDato ? "—" : `$${(Number(val) || 0).toFixed(2)}`}
                  </td>
                );
              }

              if (col.type === "number") {
                return (
                  <td key={col.key}>
                    {sinDato ? "—" : (Number(val) || 0).toLocaleString()}
                  </td>
                );
              }

              if (col.type === "percent") {
                return (
                  <td key={col.key}>
                    {sinDato ? "—" : `${(Number(val) || 0).toFixed(1)}%`}
                  </td>
                );
              }

              if (col.type === "bold") {
                return (
                  <td key={col.key}>
                    <strong>{val}</strong>
                  </td>
                );
              }

              if (col.type === "badge" && col.badgeStyles) {
                const badge = col.badgeStyles(val);
                return (
                  <td key={col.key}>
                    <Badge status={badge.className as "badgeActivo" | "badgeAnulado"} styles={styles}>
                      {badge.label}
                    </Badge>
                  </td>
                );
              }

              // Default: text
              return (
                <td key={col.key}>
                  {val !== undefined && val !== null ? String(val) : ""}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
