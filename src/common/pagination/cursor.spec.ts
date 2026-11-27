import { buildPage, decodeCursor, encodeCursor } from './cursor';

const id = '0b5c1a4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const createdAt = new Date('2026-01-02T03:04:05.000Z');

describe('cursor pagination', () => {
  it('round-trips a cursor', () => {
    const decoded = decodeCursor(encodeCursor({ createdAt, id }));
    expect(decoded.id).toBe(id);
    expect(decoded.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it('rejects a malformed cursor with INVALID_CURSOR', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(
      expect.objectContaining({ code: 'INVALID_CURSOR', status: 400 }),
    );
  });

  it('slices an over-fetched page and exposes the next cursor', () => {
    const rows = Array.from({ length: 4 }, (_, index) => ({
      id: `${index}`,
      createdAt: new Date(createdAt.getTime() - index * 1000),
    }));
    const page = buildPage(rows, 3);
    expect(page.items).toHaveLength(3);
    expect(page.pageInfo.hasMore).toBe(true);
    expect(page.pageInfo.nextCursor).not.toBeNull();
    expect(decodeCursor(page.pageInfo.nextCursor as string).id).toBe('2');
  });

  it('returns no cursor on the last page', () => {
    const rows = [{ id: '1', createdAt }];
    const page = buildPage(rows, 3);
    expect(page.pageInfo).toEqual({ nextCursor: null, hasMore: false });
  });
});
