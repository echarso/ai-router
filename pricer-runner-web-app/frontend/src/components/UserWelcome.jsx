import { useAuth } from '../contexts/AuthContext';
import './UserWelcome.css';

function UserWelcome() {
  const { user, logout } = useAuth();

  if (!user) {
    return null;
  }

  const username = user.preferred_username || user.name || user.email || 'User';
  const roles = user.realm_access?.roles || [];

  return (
    <div className="user-welcome">
      <div className="user-info">
        <span className="user-icon">👤</span>
        <span className="username">{username}</span>
        {roles.length > 0 && (
          <span className="user-roles">
            ({roles.join(', ')})
          </span>
        )}
      </div>
      <button onClick={logout} className="logout-button">
        Logout
      </button>
    </div>
  );
}

export default UserWelcome;
