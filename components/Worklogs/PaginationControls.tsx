interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const PaginationControls = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}: PaginationControlsProps) => {
  return (
    <div className="mt-4 flex justify-between items-center">
      <div>
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50"
        >
          Previous
        </button>
        <span className="mx-2 text-sm">{currentPage}</span>
        <button
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => onPageChange(currentPage + 1)}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded-lg disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div>
        <span className="text-sm text-gray-500">
          Showing {pageSize * (currentPage - 1) + 1} to{" "}
          {Math.min(pageSize * currentPage, totalItems)} of{" "}
          {totalItems} entries
        </span>
      </div>
    </div>
  );
};