import { pool } from './db.js';

// REQ-025: visits stay per day for 365 days, then are kept per month. One
// statement moves them — deleted from the daily table and added to the monthly
// one together — so a visit is never counted twice or lost. Daily cron.
export async function rollUpOldVisits() {
  const result = await pool.query<{ moved: number }>(`
    with moved as (
      delete from page_visits_daily where day < current_date - 365
      returning page_id, day, views
    ), added as (
      insert into page_visits_monthly (page_id, month, views)
      select page_id, date_trunc('month', day)::date, sum(views)::int from moved group by 1, 2
      on conflict (page_id, month) do update set views = page_visits_monthly.views + excluded.views
      returning 1
    )
    select count(*)::int as moved from moved`);
  return { movedDays: result.rows[0]?.moved ?? 0 };
}
