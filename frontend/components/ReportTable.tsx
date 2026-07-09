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
