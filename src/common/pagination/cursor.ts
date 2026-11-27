import { AppException } from '../errors/app.exception';

export interface PageInfo {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorValue {
  createdAt: Date;
  id: string;
}

export function encodeCursor(value: CursorValue): string {
  return Buffer.from(
    JSON.stringify({ t: value.createdAt.toISOString(), i: value.id }),
    'utf8',
  ).toString('base64url');
}

export function decodeCursor(cursor: string): CursorValue {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new AppException('INVALID_CURSOR', 'The pagination cursor is not valid', 400);
  }

  const candidate = parsed as { t?: unknown; i?: unknown };
  if (typeof candidate?.t !== 'string' || typeof candidate?.i !== 'string') {
    throw new AppException('INVALID_CURSOR', 'The pagination cursor is not valid', 400);
  }

  const createdAt = new Date(candidate.t);
  if (Number.isNaN(createdAt.getTime())) {
    throw new AppException('INVALID_CURSOR', 'The pagination cursor is not valid', 400);
  }

  return { createdAt, id: candidate.i };
}

export function cursorFilter(cursor: CursorValue) {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

export function buildPage<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
): { items: T[]; pageInfo: PageInfo } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    pageInfo: {
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
      hasMore,
    },
  };
}
