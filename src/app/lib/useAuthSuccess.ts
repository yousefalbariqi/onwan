import { useNavigate } from 'react-router';
import { usePageContext } from '../context/PageContext';
import { AuthResponse } from './api';
import { isNonprofitHost } from './site';
import { sessionOwner, setSessionToken } from './session';

// Shared tail of signup / login / password reset: store the session, load the
// account into the editor state and open the builder.
// `keepDraft`: a guest who designed before signing up keeps that design as an
// unsaved draft on the new account (the signup itself does not carry it).
// Only a new signup by a guest carries it: logging in to an existing account
// never takes over what is on screen (note 42).
export function useAuthSuccess(options: { keepDraft?: boolean } = {}) {
  const navigate = useNavigate();
  const { pageData, replacePageData, restoreDraft, setAccount, setAuthenticated } = usePageContext();

  return (response: AuthResponse, call: { keepDraft?: boolean; newNonprofit?: boolean } = {}) => {
    const draft = pageData;
    const keepDraft = (call.keepDraft ?? options.keepDraft) && sessionOwner() === 'guest';
    setSessionToken(response.token);
    replacePageData(response.pageData);
    if (keepDraft) restoreDraft({ ...draft, username: response.pageData.username ?? draft.username });
    setAccount(response.account);
    setAuthenticated(true);
    // Note 19: a nonprofit that has just signed up picks its platforms first.
    if (call.newNonprofit) { navigate(isNonprofitHost() ? '/onboarding' : '/nonprofit/onboarding', { replace: true }); return; }
    navigate(isNonprofitHost() ? '/account' : response.account?.kind === 'nonprofit' ? '/nonprofit/account' : '/builder', { replace: true });
  };
}
