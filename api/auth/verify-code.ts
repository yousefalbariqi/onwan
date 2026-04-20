import { createSessionToken } from '../_lib/auth';
import { pool } from '../_lib/db';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page';
import { allowMethods, handleApiError, readJsonBody, sendJson } from '../_lib/http';
import { getUsernameAvailability, normalizeUsername } from '../_lib/username';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = normalizeEmail(String(body.email ?? ''));
    const code = String(body.code ?? '').trim();

    if (!email || !code) {
      sendJson(res, 400, { error: 'البريد الإلكتروني ورمز التحقق مطلوبان.' });
      return;
    }

    // Find valid, unused code
    const codeResult = await pool.query(
      `SELECT id, phone, username FROM verification_codes
       WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [email, code.padStart(4, '0')],
    );

    if (!codeResult.rowCount) {
      sendJson(res, 401, { error: 'رمز التحقق غير صحيح أو منتهي الصلاحية.' });
      return;
    }

    const verificationRow = codeResult.rows[0];
    const phone = verificationRow.phone || '';
    const desiredUsername = verificationRow.username
      ? normalizeUsername(verificationRow.username)
      : '';

    // Mark code as used
    await pool.query(
      'UPDATE verification_codes SET used = TRUE WHERE id = $1',
      [verificationRow.id],
    );

    const client = await pool.connect();

    try {
      await client.query('begin');

      let isNewUser = false;
      let userResult = await client.query<{ id: string; email: string; phone: string }>(
        'SELECT id, email, phone FROM users WHERE email = $1 LIMIT 1',
        [email],
      );

      if (!userResult.rowCount) {
        isNewUser = true;
        userResult = await client.query<{ id: string; email: string; phone: string }>(
          'INSERT INTO users (email, phone) VALUES ($1, $2) RETURNING id, email, phone',
          [email, phone || null],
        );
      } else if (phone) {
        // Update phone if provided and user already exists
        await client.query('UPDATE users SET phone = $1 WHERE id = $2', [
          phone,
          userResult.rows[0].id,
        ]);
      }

      const user = userResult.rows[0];

      const usernameResult = await client.query<{ username: string }>(
        'SELECT username FROM usernames WHERE user_id = $1 LIMIT 1',
        [user.id],
      );

      if (!usernameResult.rowCount && desiredUsername) {
        const availability = await getUsernameAvailability(desiredUsername);

        if (!availability.available) {
          await client.query('rollback');
          sendJson(res, 409, {
            error: availability.reason,
            usernameStatus: availability.status,
          });
          return;
        }

        try {
          await client.query(
            'INSERT INTO usernames (user_id, username) VALUES ($1, $2)',
            [user.id, desiredUsername],
          );
        } catch (error: any) {
          if (error?.code === '23505') {
            await client.query('rollback');
            sendJson(res, 409, {
              error: 'اسم المستخدم مستخدم بالفعل.',
              usernameStatus: 'taken',
            });
            return;
          }
          throw error;
        }
      }

      await ensurePageForUser(user.id, client);
      await client.query('commit');

      const pageData = await getPageDataByUserId(user.id);
      const token = createSessionToken(user.id, email);

      sendJson(res, 200, {
        token,
        isNewUser,
        user: {
          id: user.id,
          email,
          phone: user.phone || phone,
        },
        pageData,
      });
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    handleApiError(res, error);
  }
}
