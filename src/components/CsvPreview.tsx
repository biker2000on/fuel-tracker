'use client'

interface CsvPreviewProps {
  data: Record<string, string>[]
  maxRows?: number
}

export function CsvPreview({ data, maxRows = 10 }: CsvPreviewProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500 dark:text-gray-400">
        No data to preview
      </div>
    )
  }

  const headers = Object.keys(data[0])
  const displayRows = data.slice(0, maxRows)
  const remainingRows = data.length - maxRows

  return (
    <div className="space-y-2">
      <div className="overflow-auto max-h-80 border border-slate-700 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-800 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700">
                #
              </th>
              {headers.map((header) => (
                <th
                  key={header}
                  className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {displayRows.map((row, index) => (
              <tr
                key={index}
                className="hover:bg-slate-800/50 transition-colors"
              >
                <td className="px-3 py-2 text-slate-500 text-xs">
                  {index + 1}
                </td>
                {headers.map((header) => (
                  <td
                    key={header}
                    className="px-3 py-2 text-slate-300 whitespace-nowrap"
                  >
                    {row[header] || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {remainingRows > 0 && (
        <p className="text-sm text-slate-400 text-center">
          ...and {remainingRows} more row{remainingRows !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
