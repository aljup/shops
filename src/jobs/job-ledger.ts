import { JobStatus, Prisma } from '@prisma/client';

export async function markOutbox(
  client: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  outboxId: string | undefined,
  status: JobStatus,
  error?: unknown,
): Promise<void> {
  if (!outboxId) {
    return;
  }
  await client.outboxJob.update({
    where: { id: outboxId },
    data: {
      status,
      attempts: status === JobStatus.PROCESSING ? { increment: 1 } : undefined,
      lastError: error ? String(error).slice(0, 1000) : null,
    },
  });
}

export function retryBackoff(attemptsMade: number): number {
  const base = 5_000 * 2 ** Math.max(0, attemptsMade - 1);
  return Math.round(base * (0.5 + Math.random()));
}
