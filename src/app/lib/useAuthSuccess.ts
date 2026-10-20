import { useNavigate } from 'react-router';
import { usePageContext } from '../context/PageContext';
import { AuthResponse } from './api';
import { setSessionToken } from './session';

// Shared tail of signup / login / password reset: store the session, load the
// account into the editor state and open the builder.
// `keepDraft`: a guest who designed before signing up keeps that design as an
// unsaved draft on the new account (the signup itself does not carry it).
export function useAuthSuccess(options: { keepDraft?: boolean } = {}) {
  const navigate = useNavigate();
  const { pageData, replacePageData, restoreDraft, setAccount, setAuthenticated } = usePageContext();

  return (response: AuthResponse) => {
    const draft = pageData;
    setSessionToken(response.token);
    replacePageData(response.pageData);
    if (options.keepDraft) restoreDraft({ ...draft, username: response.pageData.username ?? draft.username });
    setAccount(response.account);
    setAuthenticated(true);
    navigate('/builder', { replace: true });
  };
}
