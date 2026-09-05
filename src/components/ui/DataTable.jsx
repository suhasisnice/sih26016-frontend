import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/* Sortable columns, right-aligned tabular numbers, clickable rows, an empty
   slot. Built once, used on every list screen in the product.

   Sorting happens client-side over whatever page of rows was fetched — every
   list in the app is already paginated or capped by the server, so this
   never sorts more than a screenful. */
export default function DataTable({
  columns,
  rows,
  getRowKey,
  onRowClick,
  isRowFlagged,
  initialSort,
  caption,
  empty,
}) {
  const [sort, setSort] = useState(initialSort || null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const value = column.sortValue || ((row) => row[sort.key]);
    const withIndex = rows.map((row, index) => ({ row, index }));
    withIndex.sort((a, b) => {
      const av = value(a.row);
      const bv = value(b.row);
      let cmp;
      if (av === bv) cmp = 0;
      else if (av === null || av === undefined) cmp = 1;
      else if (bv === null || bv === undefined) cmp = -1;
      else cmp = av > bv ? 1 : -1;
      if (cmp === 0) cmp = a.index - b.index;
      return sort.direction === 'desc' ? -cmp : cmp;
    });
    return withIndex.map((entry) => entry.row);
  }, [rows, sort, columns]);

  function toggleSort(column) {
    if (!column.sortable) return;
    setSort((current) => {
      if (!current || current.key !== column.key) return { key: column.key, direction: 'asc' };
      if (current.direction === 'asc') return { key: column.key, direction: 'desc' };
      return null;
    });
  }

  if (!rows || rows.length === 0) {
    return <div className="table-empty">{empty}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = sort && sort.key === column.key;
              return (
                <th
                  key={column.key}
                  className={column.align === 'num' ? 'num' : undefined}
                  aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className={`data-table__sort${active ? ' is-active' : ''}`}
                      onClick={() => toggleSort(column)}
                    >
                      {column.header}
                      {active &&
                        (sort.direction === 'asc' ? (
                          <ChevronUp size={12} strokeWidth={2} />
                        ) : (
                          <ChevronDown size={12} strokeWidth={2} />
                        ))}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const flagged = isRowFlagged && isRowFlagged(row);
            return (
              <tr
                key={getRowKey(row)}
                className={`${onRowClick ? 'is-clickable' : ''}${flagged ? ' is-flagged' : ''}`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter') onRowClick(row);
                      }
                    : undefined
                }
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.align === 'num' ? 'num' : undefined}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {caption && <p className="data-table__caption">{caption}</p>}
    </div>
  );
}
