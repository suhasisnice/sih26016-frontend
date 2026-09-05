import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Loading from '../components/states/Loading';

/* Route guard. Signed out goes to Login with the attempted path remembered;
   signed in but wrong role goes to NotAuthorised, which says which role is
   signed in rather than just refusing. */
export default function RequireRole({ roles, children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Loading label="Checking your session" />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && roles.length && !roles.includes(user.role)) {
    return <Navigate to="/not-authorised" replace state={{ from: location.pathname }} />;
  }

  return children;
}
