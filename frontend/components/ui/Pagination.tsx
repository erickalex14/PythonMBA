import React from "react";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  styles: Record<string, string>;
  itemLabel: string;
  pageSizeOptions?: number[];
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  styles,
  itemLabel,
  pageSizeOptions = [10, 25, 50, 100],
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const isLastPage = currentPage >= totalPages;

  return (
    <div className={styles.paginationRow}>
      <div className={styles.paginationInfo}>
        Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(totalItems, currentPage * itemsPerPage)} de {totalItems} {itemLabel}
      </div>
      <div className={styles.paginationButtons}>
        <button onClick={() => onPageChange(1)} disabled={currentPage === 1} className={styles.pageBtn}>
          &lt;&lt;
        </button>
        <button onClick={() => onPageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={styles.pageBtn}>
          Anterior
        </button>
        <span className={styles.pageNumber}>
          Pág. {currentPage} de {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={isLastPage}
          className={styles.pageBtn}
          style={isLastPage ? {} : { background: "#ffffff", color: "#005daa" }}
        >
          Siguiente
        </button>
        <button onClick={() => onPageChange(totalPages)} disabled={isLastPage} className={styles.pageBtn}>
          &gt;&gt;
        </button>
      </div>
      <div className={styles.itemsPerPageSelect}>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size} {itemLabel}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
