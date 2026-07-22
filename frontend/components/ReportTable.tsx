import React from "react";
import { ReportConfig } from "../lib/reports-config";
import { Badge } from "./ui/Badge";

// Concepto/tipo de movimiento manual se distingue con un color propio (no es
// un estado de error/badge, solo una categoria distinta al resto).
const MANUAL_CONCEPT_COLOR = "var(--color-warning-dark)";

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

              if (col.type === "currency") {
                const numVal = Number(val) || 0;
                return (
                  <td key={col.key}>
                    ${numVal.toFixed(2)}
                  </td>
                );
              }

              if (col.type === "number") {
                const numVal = Number(val) || 0;
                return (
                  <td key={col.key}>
                    {numVal.toLocaleString()}
                  </td>
                );
              }

              if (col.type === "percent") {
                const numVal = Number(val) || 0;
                return (
                  <td key={col.key}>
                    {numVal.toFixed(1)}%
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

              if (col.type === "link") {
                return (
                  <td key={col.key}>
                    <span style={{ color: "var(--color-brand-primary-dark)" }}>{val !== undefined && val !== null ? String(val) : ""}</span>
                  </td>
                );
              }

              if (col.type === "concept") {
                const isManual = /manual/i.test(String(val || ""));
                return (
                  <td key={col.key}>
                    <span style={isManual ? { color: MANUAL_CONCEPT_COLOR, fontWeight: 600 } : undefined}>
                      {val !== undefined && val !== null ? String(val) : ""}
                    </span>
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
