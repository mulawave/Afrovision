// ═══════════════════════════════════════════════════════════════════════════════
//  PREMIUM REACT — Data Table Component (admin style)
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react';

/**
 * PremiumDataTable — Paginated table with hover effects.
 *
 * Props:
 *   - columns (Array<{ key, label, render? }>)
 *   - rows (Array<object>)
 *   - emptyMessage (string)
 *   - defaultPageSize (number)
 *   - pageSizeOptions (number[])
 */
export default function PremiumDataTable({
  columns = [],
  rows = [],
  emptyMessage = 'No data',
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50],
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const startIdx = (page - 1) * pageSize;
  const pagedRows = useMemo(() => rows.slice(startIdx, startIdx + pageSize), [rows, startIdx, pageSize]);
  const fromItem = rows.length === 0 ? 0 : startIdx + 1;
  const toItem = Math.min(startIdx + pageSize, rows.length);

  return (
    <div style={{
      borderRadius: 'var(--av-radius-2xl)',
      border: '1px solid rgba(255,255,255,0.08)',
      background: 'var(--av-surface)',
      boxShadow: 'var(--av-shadow-card)',
      backdropFilter: 'blur(20px)',
      overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="av-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--av-light-orange)' }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pagedRows.map((row, i) => (
                <tr key={row.id ?? row.uid ?? i}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {rows.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          fontSize: '0.75rem',
          color: 'var(--av-light-orange)',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              style={{
                background: 'var(--av-input-fill)',
                border: '1px solid rgba(30,42,90,0.4)',
                borderRadius: '6px',
                color: 'var(--av-white)',
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
              }}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <span>per page</span>
          </div>

          <span>{fromItem}–{toItem} of {rows.length}</span>

          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <PaginationBtn disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</PaginationBtn>
            <PaginationBtn disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next ›</PaginationBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginationBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.375rem 0.75rem',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: disabled ? 'transparent' : 'rgba(255,255,255,0.05)',
        color: disabled ? 'rgba(255,255,255,0.3)' : 'var(--av-light-orange)',
        fontSize: '0.75rem',
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
