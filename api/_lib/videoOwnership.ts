import { pool } from './db.js';

// Creation uploads keep their original folder/Stream owner after signup.
// Only the server's completed-draft link can grant the resulting account access.
export async function videoOwnerMatches(actualOwner: string | undefined, owner: string, db: Pick<typeof pool, 'query'> = pool) {
  if (!actualOwner) return false;
  if (actualOwner === owner) return true;
  const result = await db.query('select id from creation_email_drafts where id=$1 and account_user_id=$2 and revoked_at is null', [actualOwner, owner]);
  return Boolean(result.rows[0]);
}
