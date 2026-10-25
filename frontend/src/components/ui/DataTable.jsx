import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';
import Pagination from './Pagination';

/**
 * DataTable: columns, sortable headers, loading skeleton, empty state,
 * pagination, and optional row click.
 */
export function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyTitle = 'No data available',
  emptyMessage,
  emptyIcon,
  onRowClick,
  pageSize = 10,
  pagination = false,
  className = '',
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);

  const handleSort = (col) => {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    return [...data].sort((a, b) => {
      const valA = col?.sortValue ? col.sortValue(a) : a[sortKey];
      const valB = col?.sortValue ? col.sortValue(b) : b[sortKey];
      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;
      const cmp = valA > valB ? 1 : -1;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir, columns]);

  const totalPages = pagination ? Math.ceil(sortedData.length / pageSize) : 1;
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, pagination, currentPage, pageSize]);

  return (
    <div className={`data-table-wrapper ${className}`}>
      <div className="data-table-scroll">
        <table className="data-table-ui">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align || 'left' }}
                  className={col.sortable ? 'is-sortable' : ''}
                  onClick={() => handleSort(col)}
                >
                  <div className="table-header-cell" style={{ justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="table-sort-icon">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? (
                            <ArrowUp size={13} />
                          ) : (
                            <ArrowDown size={13} />
                          )
                        ) : (
                          <ArrowUpDown size={13} style={{ opacity: 0.4 }} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, rIdx) => (
                <tr key={`loading-${rIdx}`}>
                  {columns.map((col) => (
                    <td key={col.key}>
                      <Skeleton height="18px" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty-cell">
                  <EmptyState
                    icon={emptyIcon}
                    title={emptyTitle}
                    message={emptyMessage}
                  />
                </td>
              </tr>
            ) : (
              paginatedData.map((row, rIdx) => (
                <tr
                  key={row.id || row._id || rIdx}
                  className={onRowClick ? 'is-clickable' : ''}
                  onClick={() => onRowClick && onRowClick(row)}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{ textAlign: col.align || 'left' }}
                    >
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && totalPages > 1 && (
        <div className="data-table-pagination">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}

export default DataTable;
