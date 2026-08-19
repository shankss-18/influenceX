import { Counter } from '../models/Counter';
import { dayjs, DEFAULT_TIMEZONE } from '../config/timezone';

/**
 * Atomically generates the next InfluenceX ID in format 'IX-000001'
 * Race-condition safe via MongoDB findOneAndUpdate with $inc
 */
export async function generateNextInfluenceXId(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'student_influencex_id' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(6, '0');
  return `IX-${paddedSeq}`;
}

/**
 * Atomically generates the next Event ID in format 'IXE-YYYY-NNN' (e.g. 'IXE-2026-001')
 * Sequence resets or partitions per year in Asia/Kolkata timezone
 */
export async function generateNextEventId(): Promise<string> {
  const currentYear = dayjs().tz(DEFAULT_TIMEZONE).format('YYYY');
  const sequenceKey = `event_id_${currentYear}`;

  const counter = await Counter.findOneAndUpdate(
    { _id: sequenceKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(3, '0');
  return `IXE-${currentYear}-${paddedSeq}`;
}

/**
 * Atomically generates the next Transaction ID in format 'TX-0000001'
 * Race-condition safe via MongoDB findOneAndUpdate with $inc
 */
export async function generateNextTransactionId(): Promise<string> {
  const counter = await Counter.findOneAndUpdate(
    { _id: 'credit_transaction_id' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const paddedSeq = String(counter.seq).padStart(7, '0');
  return `TX-${paddedSeq}`;
}

/**
 * Atomically generates a block of N Transaction IDs in 1 single DB call
 */
export async function generateNextTransactionIdBlock(count: number): Promise<string[]> {
  if (count <= 0) return [];
  const counter = await Counter.findOneAndUpdate(
    { _id: 'credit_transaction_id' },
    { $inc: { seq: count } },
    { new: true, upsert: true }
  );

  const startSeq = counter.seq - count + 1;
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const paddedSeq = String(startSeq + i).padStart(7, '0');
    result.push(`TX-${paddedSeq}`);
  }
  return result;
}

