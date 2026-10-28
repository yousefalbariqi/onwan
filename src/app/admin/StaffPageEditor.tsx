import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { PageProvider, PageSource } from '../context/PageContext';
import { adminLink } from '../lib/site';
import Builder from '../pages/Builder';
import { adminCall } from './adminApi';

// PERM-01: an employee edits a customer's page with the same editor the
// customer uses, loading and saving through the administration API.
export default function StaffPageEditor() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const source = useMemo<PageSource>(
    () => ({
      load: () => adminCall('content.getPage', { userId }),
      save: (pageData) => adminCall('content.save', { userId, pageData }),
    }),
    [userId],
  );

  return (
    <PageProvider source={source}>
      <Builder staffEdit={{ onExit: () => navigate(`${adminLink()}?customer=${userId}`) }} />
    </PageProvider>
  );
}
