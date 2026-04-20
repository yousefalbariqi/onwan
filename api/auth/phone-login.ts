import { createSessionToken } from '../_lib/auth';
import { pool } from '../_lib/db';
import { ensurePageForUser, getPageDataByUserId } from '../_lib/page';
import { allowMethods, handleApiError, readJsonBody, sendJson } from '../_lib/http';
import { getUsernameAvailability, normalizeUsername } from '../_lib/username';

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

export default async function handler(req: any, res: any) {
  if (!allowMethods(req, res, ['POST'])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const phone = normalizePhone(String(body.phone ?? ''));
    const desiredUsername = body.username ? normalizeUsername(String(body.username)) : '';

    if (!/^[0-9]{8,20}$/.test(phone)) {
      sendJson(res, 400, { error: 'رقم الجوال غير صالح.' });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query('begin');

      let isNewUser = false;
      let userResult = await client.query<{ id: string; phone: string }>(
        'select id, phone from users where phone = $1 limit 1',
        [phone],
      );

      if (!userResult.rowCount) {
        isNewUser = true;
        userResult = await client.query<{ id: string; phone: string }>(
          'insert into users (phone) values ($1) returning id, phone',
          [phone],
        );
      }

      const user = userResult.rows[0];

      const usernameResult = await client.query<{ username: string }>(
        'select username from usernames where user_id = $1 limit 1',
        [user.id],
      );

        if (!usernameResult.rowCount && desiredUsername) {
          const availability = await getUsernameAvailability(desiredUsername);

          if (!availability.available) {
            await client.query('rollback');
          sendJson(res, 409, { error: availability.reason, usernameStatus: availability.status });
          return;
        }

          try {
            await client.query(
              'insert into usernames (user_id, username) values ($1, $2)',
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
      const token = createSessionToken(user.id, user.phone);

      sendJson(res, 200, {
        token,
        isNewUser,
        user: {
          id: user.id,
          phone: user.phone,
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
