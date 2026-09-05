import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';
import { getToken, setToken } from '../api/client';

/* Current user, token, login and logout.

   The token is kept in localStorage so a refresh does not sign the person out
   mid-demo, and the user object is re-read from /auth/me on load rather than
   decoded from the token — a deactivated account or a changed role has to
   take effect immediately, which is also how the backend treats it. */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    if (!getToken()) {
      setReady(true);
      return undefined;
    }

    authApi
      .me()
      .then((data) => {
        if (active) setUser(data);
      })
      .catch(() => {
        // An expired or rejected token is not an error state to show — it is
        // simply a signed-out session.
        setToken(null);
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  /* The password step only — POST /auth/login now always answers
     {mfa_required, mfa_token, totp_enabled} rather than a token, so
     nothing here is signed in yet. The caller (Login.jsx) shows the code
     step next and finishes with verifyMfaCode. */
  const login = useCallback((username, password) => authApi.login(username, password), []);

  /* The second step: redeem an mfa_token plus the code it asked for. This
     is where a password login actually becomes a session, the same way
     verifying a face or fingerprint capture does. */
  const verifyMfaCode = useCallback(async (mfaToken, code) => {
    const result = await authApi.verifyLoginCode(mfaToken, code);
    setToken(result.access_token);
    setUser(result.user);
    return result.user;
  }, []);

  /* Registration, and face/fingerprint login, already return a token and a
     user in one response, so this adopts that session without a second
     round trip to /auth/me. The caller stores the token; this puts the
     user into context. */
  const adopt = useCallback((who) => setUser(who), []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, verifyMfaCode, logout, adopt, isAuthenticated: Boolean(user) }),
    [user, ready, login, verifyMfaCode, logout, adopt],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
