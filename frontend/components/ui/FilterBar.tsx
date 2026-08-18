import React from "react";
import { MultiSelect } from "./MultiSelect";

export interface FilterFieldConfig {
  label: string;
  value: string | string[];
  onChange: ((value: string) => void) | ((value: string[]) => void);
  placeholder: string;
  options: string[];
  type?: "select" | "text" | "multiselect";
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
    <h4 className={styles.filterPanelSubLabel}>
      <svg className={styles.filterPanelSubLabelIcon} width="12" height="12" viewBox="0 0 20 20" fill="none">
        <path d="M3 4.5h14M6 10h8M8.5 15.5h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      {label}
    </h4>
    <div className={styles.subFiltersRow}>
      {fields.map((field) => (
        <div key={field.label} className={styles.filterGroup}>
          <label>{field.label}</label>
          {field.type === "text" ? (
            <input
              type="text"
              value={field.value as string}
              onChange={(e) => (field.onChange as (v: string) => void)(e.target.value)}
              placeholder={field.placeholder}
              className={styles.selectFilter}
            />
          ) : field.type === "multiselect" ? (
            <MultiSelect
              options={field.options}
              selected={field.value as string[]}
              onChange={field.onChange as (v: string[]) => void}
              placeholder={field.placeholder}
            />
          ) : (
            <select
              value={field.value as string}
              onChange={(e) => (field.onChange as (v: string) => void)(e.target.value)}
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
