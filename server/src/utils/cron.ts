import cron from 'node-cron';
import { reconcileLedgerWithCache, takeMonthlyRankingSnapshot } from './ledger';
import { DEFAULT_TIMEZONE } from '../config/timezone';

export function initializeScheduledJobs(): void {
  console.log('[CRON] Initializing scheduled jobs in timezone:', DEFAULT_TIMEZONE);

  // 1. Nightly Ledger Reconciliation (00:05 AM IST every night)
  cron.schedule(
    '5 0 * * *',
    async () => {
      console.log('[CRON] Starting nightly credit ledger reconciliation...');
      try {
        const result = await reconcileLedgerWithCache();
        console.log(
          `[CRON] Reconciliation complete. Inspected: ${result.inspected}, Mismatches fixed: ${result.fixed}`
        );
      } catch (err) {
        console.error('[CRON] Error during ledger reconciliation:', err);
      }
    },
    { timezone: DEFAULT_TIMEZONE }
  );

  // 2. Month-End Ranking Snapshot (23:55 on the last day of every month)
  cron.schedule(
    '55 23 28-31 * *',
    async () => {
      console.log('[CRON] Checking and taking month-end ranking snapshot...');
      try {
        const result = await takeMonthlyRankingSnapshot();
        console.log(`[CRON] Snapshot recorded for ${result.month}: ${result.totalStudents} students, v${result.version}`);
      } catch (err) {
        console.error('[CRON] Error during month-end snapshot generation:', err);
      }
    },
    { timezone: DEFAULT_TIMEZONE }
  );
}
