import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './OrganizationManagement.css';

const RAW_AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL;
// If a stale local .env points to 3002, force our dev proxy to avoid CORS.
const AUTH_API_URL = ((typeof RAW_AUTH_API_URL === 'string' && RAW_AUTH_API_URL.includes('localhost:3002'))
  ? '/auth-api'
  : (RAW_AUTH_API_URL || '/auth-api'))
  .replace(/\/+$/, '')
  // tolerate older configs like http://host:port/api
  .replace(/\/api$/, '');

function OrganizationManagement() {
  const { getToken, isSystemOwner, isSystemAdmin } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorCooldown, setErrorCooldown] = useState(false);

  // Form states
  const [showCreateOrgForm, setShowCreateOrgForm] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [newOrgOAUsername, setNewOrgOAUsername] = useState('');
  const [newOrgOAPassword, setNewOrgOAPassword] = useState('');
  const [newOrgOAEmail, setNewOrgOAEmail] = useState('');

  // User assignment states
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [assignUsername, setAssignUsername] = useState('');
  const [assignRole, setAssignRole] = useState('OA');
  const [assigningUser, setAssigningUser] = useState(false);

  // Create OA user states
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createOrgId, setCreateOrgId] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  const canAdmin = isSystemOwner() || isSystemAdmin();

  const fetchOrganizations = useCallback(async () => {
    if (!canAdmin) return;

    setLoading(true);
    try {
      const token = await getToken();
      const response = await axios.get(`${AUTH_API_URL}/api/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrganizations(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching organizations:', err);
      if (!errorCooldown) {
        setError(err.response?.data?.error || 'Failed to load organizations');
        setErrorCooldown(true);
        setTimeout(() => setErrorCooldown(false), 5000);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, canAdmin, errorCooldown]);

  const fetchUsers = useCallback(async () => {
    if (!canAdmin) return;
    try {
      const token = await getToken();
      const response = await axios.get(`${AUTH_API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (err) {
      console.error('Error fetching users:', err);
      if (!errorCooldown) {
        setError(err.response?.data?.error || 'Failed to load users');
        setErrorCooldown(true);
        setTimeout(() => setErrorCooldown(false), 5000);
      }
    }
  }, [getToken, canAdmin, errorCooldown]);

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    if (!newOrgName.trim()) {
      setError('Please provide an organization name');
      return;
    }

    setCreatingOrg(true);
    try {
      const token = await getToken();
      const createdOrgResp = await axios.post(
        `${AUTH_API_URL}/api/organizations`,
        {
          name: newOrgName,
          description: newOrgDescription,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // If SA provided OA creds, create OA user and assign it to the new org in one flow
      const orgId = createdOrgResp.data?.id;
      if (orgId && newOrgOAUsername.trim() && newOrgOAPassword.trim()) {
        await axios.post(
          `${AUTH_API_URL}/api/admin/users`,
          {
            username: newOrgOAUsername.trim(),
            password: newOrgOAPassword,
            email: newOrgOAEmail?.trim() || undefined,
            organization_id: Number(orgId),
            role: 'organization-admin',
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setNewOrgName('');
      setNewOrgDescription('');
      setNewOrgOAUsername('');
      setNewOrgOAPassword('');
      setNewOrgOAEmail('');
      setShowCreateOrgForm(false);
      await fetchOrganizations();
      await fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create organization');
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleAssignUser = async (e) => {
    e.preventDefault();
    if (!selectedOrgId || !assignUsername.trim()) {
      setError('Please select an organization and provide a username');
      return;
    }

    setAssigningUser(true);
    try {
      const token = await getToken();
      await axios.post(
        `${AUTH_API_URL}/api/organizations/${selectedOrgId}/assign-user`,
        {
          username: assignUsername,
          role: assignRole,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setAssignUsername('');
      setAssignRole('OA');
      setError(null);
      alert(`User ${assignUsername} assigned successfully`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to assign user');
    } finally {
      setAssigningUser(false);
    }
  };

  const handleCreateOAUser = async (e) => {
    e.preventDefault();
    if (!createUsername.trim() || !createPassword.trim() || !createOrgId) {
      setError('Username, password, and organization are required');
      return;
    }

    setCreatingUser(true);
    try {
      const token = await getToken();
      await axios.post(
        `${AUTH_API_URL}/api/admin/users`,
        {
          username: createUsername.trim(),
          password: createPassword,
          email: createEmail?.trim() || undefined,
          organization_id: Number(createOrgId),
          role: 'organization-admin',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCreateUsername('');
      setCreatePassword('');
      setCreateEmail('');
      setCreateOrgId('');
      setError(null);
      await fetchUsers();
      alert('OA user created and assigned successfully');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteOrg = async (orgId) => {
    if (!confirm('Are you sure you want to delete this organization? This will delete all associated projects and API keys.')) {
      return;
    }

    try {
      const token = await getToken();
      await axios.delete(`${AUTH_API_URL}/api/organizations/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchOrganizations();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete organization');
    }
  };

  if (!canAdmin) {
    return (
      <div className="organization-management">
        <div className="error-message">Only System Admins can manage organizations and users.</div>
      </div>
    );
  }

  return (
    <div className="organization-management">
      <h2>Organization Management</h2>

      {error && <div className="error-message">⚠️ {error}</div>}

      <div className="actions-section">
        <button
          onClick={() => setShowCreateOrgForm(!showCreateOrgForm)}
          className="create-org-button"
        >
          {showCreateOrgForm ? 'Cancel' : '+ Create Organization'}
        </button>
      </div>

      {showCreateOrgForm && (
        <form onSubmit={handleCreateOrg} className="create-org-form">
          <div className="form-group">
            <label>Organization Name:</label>
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              required
              placeholder="e.g., Acme Corp"
            />
          </div>
          <div className="form-group">
            <label>Description:</label>
            <textarea
              value={newOrgDescription}
              onChange={(e) => setNewOrgDescription(e.target.value)}
              placeholder="Optional description"
              rows="3"
            />
          </div>
          <div className="form-group">
            <label>Organization Admin username (optional):</label>
            <input
              type="text"
              value={newOrgOAUsername}
              onChange={(e) => setNewOrgOAUsername(e.target.value)}
              placeholder="e.g., org-admin-volvo"
            />
          </div>
          <div className="form-group">
            <label>Organization Admin password (optional):</label>
            <input
              type="password"
              value={newOrgOAPassword}
              onChange={(e) => setNewOrgOAPassword(e.target.value)}
              placeholder="Set an initial password"
            />
          </div>
          <div className="form-group">
            <label>Organization Admin email (optional):</label>
            <input
              type="email"
              value={newOrgOAEmail}
              onChange={(e) => setNewOrgOAEmail(e.target.value)}
              placeholder="optional"
            />
          </div>
          <button type="submit" disabled={creatingOrg} className="submit-button">
            {creatingOrg ? 'Creating...' : 'Create Organization'}
          </button>
        </form>
      )}

      <div className="assign-user-section">
        <h3>Assign User to Organization</h3>
        <form onSubmit={handleAssignUser} className="assign-user-form">
          <div className="form-group">
            <label>Organization:</label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              required
            >
              <option value="">Select Organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Username (Keycloak):</label>
            <input
              type="text"
              value={assignUsername}
              onChange={(e) => setAssignUsername(e.target.value)}
              required
              placeholder="e.g., org-admin"
            />
          </div>
          <div className="form-group">
            <label>Role:</label>
            <select
              value={assignRole}
              onChange={(e) => setAssignRole(e.target.value)}
              required
            >
              <option value="OA">Organization Admin (OA)</option>
              <option value="PA">Project Admin (PA)</option>
            </select>
          </div>
          <button type="submit" disabled={assigningUser} className="submit-button">
            {assigningUser ? 'Assigning...' : 'Assign User'}
          </button>
        </form>
      </div>

      <div className="assign-user-section">
        <h3>Create Organization Admin (OA) User</h3>
        <form onSubmit={handleCreateOAUser} className="assign-user-form">
          <div className="form-group">
            <label>Organization:</label>
            <select value={createOrgId} onChange={(e) => setCreateOrgId(e.target.value)} required>
              <option value="">Select Organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Username:</label>
            <input value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password:</label>
            <input type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Email (optional):</label>
            <input value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
          </div>
          <button type="submit" disabled={creatingUser} className="submit-button">
            {creatingUser ? 'Creating...' : 'Create OA User'}
          </button>
        </form>
      </div>

      <div className="organizations-list">
        <h3>Keycloak Users</h3>
        {users.length === 0 ? (
          <div className="no-orgs">No users loaded.</div>
        ) : (
          <table className="organizations-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Org Group</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>{u.email || '-'}</td>
                  <td>{(u.roles || []).join(', ')}</td>
                  <td>{(u.groups || []).join(', ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="organizations-list">
        <h3>All Organizations</h3>
        {loading ? (
          <div className="loading">Loading organizations...</div>
        ) : organizations.length === 0 ? (
          <div className="no-orgs">No organizations found. Create one to get started.</div>
        ) : (
          <table className="organizations-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id}>
                  <td>{org.name}</td>
                  <td>{org.description || '-'}</td>
                  <td>{new Date(org.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      onClick={() => handleDeleteOrg(org.id)}
                      className="delete-button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default OrganizationManagement;
