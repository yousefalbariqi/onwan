import { useNavigate } from 'react-router';
import { usePageContext } from '../context/PageContext';
import { AuthResponse } from './api';
import { setSessionToken } from './session';

// Shared tail of signup / login / password reset: store the session, load the
// account into the editor state and open the builder.
export function useAuthSuccess() {
  const navigate = useNavigate();
  const { replacePageData, setAccount, setAuthenticated } = usePageContext();

  return (response: AuthResponse) => {
    setSessionToken(response.token);
    replacePageData(response.pageData);
    setAccount(response.account);
    setAuthenticated(true);
    navigate('/builder');
  };
}
