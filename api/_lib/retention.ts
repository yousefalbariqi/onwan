import { pool } from './db.js';

// REQ-026 (owner decision, 25 Oct 2026): operational records are kept 14
// days, the staff action log 365 days, and anything about money is never
// deleted (the payments ledger, commissions, and staff actions that confirm
// payments, set prices or record payouts). Runs from the daily cron; a table
// that does not exist yet is skipped.
const OPERATIONAL_DAYS = 14;
const ADMIN_LOG_DAYS = 365;
const FINANCIAL_ACTIONS = [
  'cart.confirmPayment', 'design.confirmPayment', 'domain.confirmPayment', 'nfc.confirmPayment',
  'partnerOrder.confirmPayment', 'subscription.activate', 'partner.recordPayout',
  'partner.setCommissionAmount', 'partner.setPrices', 'partner.setRate', 'plans.set', 'plans.setDiscount',
];

const STEPS: [string, string, unknown[]][] = [
  ['login_failures', `delete from login_failures where failed_at < now() - make_interval(days => $1)`, [OPERATIONAL_DAYS]],
  ['verification_codes', `delete from verification_codes where created_at < now() - make_interval(days => $1)`, [OPERATIONAL_DAYS]],
  ['page_save_counts', `delete from page_save_counts where day < current_date - $1::int`, [OPERATIONAL_DAYS]],
  ['media_upload_events', `delete from media_upload_events where started_at < now() - make_interval(days => $1)`, [OPERATIONAL_DAYS]],
  ['media_cleanup_log', `delete from media_cleanup_log where deleted_at < now() - make_interval(days => $1)`, [OPERATIONAL_DAYS]],
  ['audit_log', `delete from audit_log where created_at < now() - make_interval(days => $1) and not (action = any($2::text[]))`, [ADMIN_LOG_DAYS, FINANCIAL_ACTIONS]],
];

export async function applyRetention() {
  const removed: Record<string, number | string> = {};
  for (const [table, sql, values] of STEPS) {
    try {
      removed[table] = (await pool.query(sql, values)).rowCount ?? 0;
    } catch (error: any) {
      removed[table] = error?.code === '42P01' ? 'not yet created' : 'failed';
    }
  }
  return removed;
}
