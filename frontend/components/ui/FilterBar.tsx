import React from "react";

export interface FilterFieldConfig {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
}

interface FilterBarProps {
  fields: FilterFieldConfig[];
  styles: Record<string, string>;
}

export const FilterBar: React.FC<FilterBarProps> = ({ fields, styles }) => (
  <section className={styles.subFiltersSection}>
    <h4 style={{ margin: "0 0 0.85rem 0", color: "#005daa", fontSize: "0.80rem", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      Filtros de Segmentación Local (Sin recargar base de datos)
    </h4>
    <div className={styles.subFiltersRow}>
      {fields.map((field) => (
        <div key={field.label} className={styles.filterGroup}>
          <label>{field.label}</label>
          <select
            value={field.value}
            onChange={(e) => field.onChange(e.target.value)}
            className={styles.selectFilter}
          >
            <option value="">{field.placeholder}</option>
            {field.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  </section>
);
