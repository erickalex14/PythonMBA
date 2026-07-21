import React from "react";

export interface FilterFieldConfig {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[];
  type?: "select" | "text";
}

interface FilterBarProps {
  fields: FilterFieldConfig[];
  styles: Record<string, string>;
  // El caller decide el contenedor (panel unificado con fecha/búsqueda, o
  // uno propio como el del Dashboard) - este componente solo es la fila de
  // campos, no una tarjeta independiente.
  label?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  fields,
  styles,
  label = "Filtros de Segmentación Local (Sin recargar base de datos)",
}) => (
  <div>
    <h4 className={styles.filterPanelSubLabel}>{label}</h4>
    <div className={styles.subFiltersRow}>
      {fields.map((field) => (
        <div key={field.label} className={styles.filterGroup}>
          <label>{field.label}</label>
          {field.type === "text" ? (
            <input
              type="text"
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={field.placeholder}
              className={styles.selectFilter}
            />
          ) : (
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
          )}
        </div>
      ))}
    </div>
  </div>
);
