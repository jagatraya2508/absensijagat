import Icon from './Icon';

export const LIST_PAGE_SIZE = 10;

export function slicePage(items, page, pageSize = LIST_PAGE_SIZE) {
    const list = Array.isArray(items) ? items : [];
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    const pageSafe = Math.min(Math.max(1, page || 1), totalPages);
    const start = (pageSafe - 1) * pageSize;
    return {
        pageSafe,
        totalPages,
        total: list.length,
        items: list.slice(start, start + pageSize),
    };
}

export default function ListPagination({ page, total, onPageChange, itemLabel = 'data', pageSize = LIST_PAGE_SIZE }) {
    if (!total || total <= pageSize) return null;

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const pageSafe = Math.min(Math.max(1, page || 1), totalPages);
    const pageStart = (pageSafe - 1) * pageSize + 1;
    const pageEnd = Math.min(pageSafe * pageSize, total);

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                Menampilkan {pageStart}–{pageEnd} dari {total} {itemLabel}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <button type="button" className="btn btn-outline" title="Halaman awal" aria-label="Halaman awal" disabled={pageSafe <= 1} onClick={() => onPageChange(1)} style={{ padding: '0.4rem 0.65rem', minWidth: 40 }}>
                    <Icon name="ChevronsLeft" size={16} />
                </button>
                <button type="button" className="btn btn-outline" title="Halaman sebelumnya" aria-label="Halaman sebelumnya" disabled={pageSafe <= 1} onClick={() => onPageChange(Math.max(1, pageSafe - 1))} style={{ padding: '0.4rem 0.65rem', minWidth: 40 }}>
                    <Icon name="ChevronLeft" size={16} />
                </button>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gray-800)', padding: '0 0.35rem', whiteSpace: 'nowrap' }}>
                    {pageSafe} / {totalPages}
                </span>
                <button type="button" className="btn btn-outline" title="Halaman berikutnya" aria-label="Halaman berikutnya" disabled={pageSafe >= totalPages} onClick={() => onPageChange(Math.min(totalPages, pageSafe + 1))} style={{ padding: '0.4rem 0.65rem', minWidth: 40 }}>
                    <Icon name="ChevronRight" size={16} />
                </button>
                <button type="button" className="btn btn-outline" title="Halaman akhir" aria-label="Halaman akhir" disabled={pageSafe >= totalPages} onClick={() => onPageChange(totalPages)} style={{ padding: '0.4rem 0.65rem', minWidth: 40 }}>
                    <Icon name="ChevronsRight" size={16} />
                </button>
            </div>
        </div>
    );
}
