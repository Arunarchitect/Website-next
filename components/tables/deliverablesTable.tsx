// components/tables/deliverablesTable.tsx
export interface Deliverable {
  id: number;
  name: string;
  project: {
    name: string;
  };
  stage_name: string;
  status: string;
  status_name: string;
}

interface DeliverablesTableProps {
  deliverables: Deliverable[];
  isError: boolean;
}

export default function DeliverablesTable({ deliverables, isError }: DeliverablesTableProps) {
  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Assigned Deliverables
      </h2>
      {isError ? (
        <p className="text-red-500">Error loading deliverables</p>
      ) : deliverables.length === 0 ? (
        <p className="text-gray-500">No deliverables assigned</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Deliverable
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {deliverables.map((deliverable) => (
                <tr key={deliverable.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {deliverable.project.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {deliverable.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {deliverable.stage_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        deliverable.status === "passed"
                          ? "bg-green-100 text-green-800"
                          : deliverable.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : deliverable.status === "ready"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {deliverable.status_name}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}