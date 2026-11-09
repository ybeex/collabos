// Opaque cursor-based pagination — safe for live data unlike offset pagination
export const encodeCursor = (values: Record<string, string | number | Date>): string => {
  return Buffer.from(JSON.stringify(values)).toString('base64url')
}

export const decodeCursor = (cursor: string): Record<string, string | number> => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<
      string,
      string | number
    >
  } catch {
    throw new Error('Invalid pagination cursor')
  }
}

export interface PaginatedResult<T> {
  data: T[]
  meta: {
    hasNextPage: boolean
    hasPrevPage: boolean
    nextCursor: string | null
    prevCursor: string | null
    total?: number
  }
}

export const buildPaginatedResult = <T>(
  items: T[],
  limit: number,
  cursorFn: (item: T) => Record<string, string | number | Date>,
  total?: number,
): PaginatedResult<T> => {
  const hasNextPage = items.length > limit
  const data = hasNextPage ? items.slice(0, limit) : items
  const lastItem = data[data.length - 1]
  const firstItem = data[0]

  return {
    data,
    meta: {
      hasNextPage,
      hasPrevPage: false, // set by caller if prev cursor was supplied
      nextCursor: hasNextPage && lastItem ? encodeCursor(cursorFn(lastItem)) : null,
      prevCursor: firstItem ? encodeCursor(cursorFn(firstItem)) : null,
      // Bug fix (found via tsc): `total` is `number | undefined` (its
      // param is optional), but `meta.total` is declared `total?:
      // number` — under this project's `exactOptionalPropertyTypes:
      // true`, those are different things: the property may be
      // *omitted*, but may not be *present with value undefined*.
      // Spreading conditionally omits it instead of assigning
      // `undefined` to it.
      ...(total !== undefined && { total }),
    },
  }
}
