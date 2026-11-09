// PRD_AUDIT.md Finding #9: onboarding Quick Import (CSV) step. A small,
// dependency-free parser rather than pulling in a new package — this app's
// CONTINUATION_PLAN.md already flags that some npm installs (yjs, lib0)
// never actually ran in this sandboxed environment, so adding another
// unverified dependency here would compound that risk for no real benefit
// at onboarding-CSV scale (expected: tens to low hundreds of rows, capped
// at 2000 server-side). Handles quoted fields, embedded commas, embedded
// newlines inside quotes, and escaped quotes ("") — the common real-world
// CSV export cases — but is not a full RFC 4180 implementation.

export interface CsvParseResult {
  headers: string[]
  rows: string[][]
}

export const parseCsv = (text: string): CsvParseResult => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = (): void => {
    row.push(field)
    field = ''
  }
  const pushRow = (): void => {
    pushField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      pushField()
    } else if (char === '\n') {
      pushRow()
    } else if (char === '\r') {
      // skip — \r\n line endings handled via the following \n
    } else {
      field += char
    }
  }

  // Trailing field/row if the text didn't end with a newline
  if (field.length > 0 || row.length > 0) {
    pushRow()
  }

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim().length > 0))
  const [headers, ...dataRows] = nonEmpty
  return { headers: headers ?? [], rows: dataRows }
}
