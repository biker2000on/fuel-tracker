/**
 * Parse a CSV string into an array of objects.
 * Handles quoted fields, commas within quotes, and various line endings.
 *
 * @param csvString - The raw CSV string to parse
 * @returns Array of objects where keys are header names and values are strings
 */
export function parseCSV(csvString: string): Record<string, string>[] {
  if (!csvString || csvString.trim() === '') {
    return []
  }

  // Normalize line endings to \n
  const normalized = csvString.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Split into lines, filtering out empty trailing lines
  const lines = normalized.split('\n').filter((line, index, arr) => {
    // Keep all non-empty lines
    if (line.trim() !== '') return true
    // For empty lines, only filter out trailing ones
    return index < arr.length - 1 && arr.slice(index + 1).some(l => l.trim() !== '')
  })

  if (lines.length === 0) {
    return []
  }

  // Parse header row
  const headers = parseLine(lines[0])

  if (headers.length === 0) {
    return []
  }

  // Parse data rows
  const results: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line.trim() === '') {
      continue // Skip empty rows
    }

    const values = parseLine(line)
    const row: Record<string, string> = {}

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? ''
    }

    results.push(row)
  }

  return results
}

/**
 * Parse a single CSV line into an array of field values.
 * Handles quoted fields with commas and escaped quotes.
 */
function parseLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0

  while (i < line.length) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        // Check for escaped quote (double quote)
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i += 2
          continue
        } else {
          // End of quoted field
          inQuotes = false
          i++
          continue
        }
      } else {
        current += char
        i++
      }
    } else {
      if (char === '"') {
        // Start of quoted field
        inQuotes = true
        i++
      } else if (char === ',') {
        // End of field
        fields.push(current.trim())
        current = ''
        i++
      } else {
        current += char
        i++
      }
    }
  }

  // Don't forget the last field
  fields.push(current.trim())

  return fields
}
