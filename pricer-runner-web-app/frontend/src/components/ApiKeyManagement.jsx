import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './ApiKeyManagement.css';

const RAW_AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL;
// If a stale local .env points to 3002, force our dev proxy to avoid CORS.
const AUTH_API_URL = ((typeof RAW_AUTH_API_URL === 'string' && RAW_AUTH_API_URL.includes('localhost:3002'))
  ? '/auth-api'
  : (RAW_AUTH_API_URL || '/auth-api'))
  .replace(/\/+$/, '')
  // tolerate older configs like http://host:port/api
  .replace(/\/api$/, '');

function ApiKeyManagement() {
  const { getToken, isSystemOwner, isOrganizationAdmin, isProjectAdmin, user } = useAuth();
  const orgFromToken = Array.isArray(user?.groups) && user.groups.length === 1 ? user.groups[0] : null;
  const [organizations, setOrganizations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorCooldown, setErrorCooldown] = useState(false);

  // Form states
  const [showCreateKeyForm, setShowCreateKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyExpiration, setNewKeyExpiration] = useState(30);
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdToken, setCreatedToken] = useState(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  const projectIdsWithKeys = useCallback(() => {
    const s = new Set();
    for (const k of apiKeys || []) {
      const ids = Array.isArray(k.project_ids) ? k.project_ids : [];
      for (const pid of ids) s.add(String(pid));
    }
    return s;
  }, [apiKeys]);

  // Policy form states
  const [rateLimits, setRateLimits] = useState({
    requests_per_second: '',
    requests_per_minute: '',
    requests_per_hour: '',
    burst_limit: '',
  });
  const [trafficPolicy, setTrafficPolicy] = useState({
    daily_quota: '',
    monthly_quota: '',
    daily_cost_usd: '',
    monthly_cost_usd: '',
  });

  // Project creation moved to Organization view (OA)

  const fetchOrganizations = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await axios.get(`${AUTH_API_URL}/api/organizations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrganizations(response.data);
      if (response.data.length > 0 && !selectedOrgId) {
        setSelectedOrgId(response.data[0].id.toString());
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      if (!errorCooldown) {
        setError(err.response?.data?.error || 'Failed to load organizations');
        setErrorCooldown(true);
        setTimeout(() => setErrorCooldown(false), 5000);
      }
    }
  }, [getToken, selectedOrgId, errorCooldown]);

  const fetchProjects = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await axios.get(`${AUTH_API_URL}/api/projects`, {
        // SA can pass organization_id; OA ignores and uses token org group
        params: selectedOrgId && isSystemOwner() ? { organization_id: selectedOrgId } : undefined,
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(response.data);
      if (response.data.length > 0 && !selectedProjectId) setSelectedProjectId(response.data[0].id.toString());
    } catch (err) {
      console.error('Error fetching projects:', err);
      if (!errorCooldown) {
        setError(err.response?.data?.error || 'Failed to load projects');
        setErrorCooldown(true);
        setTimeout(() => setErrorCooldown(false), 5000);
      }
    }
  }, [selectedOrgId, getToken, selectedProjectId, errorCooldown, isSystemOwner]);

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await axios.get(`${AUTH_API_URL}/api/api-keys`, {
        // Fetch org-wide keys; we filter client-side for display when a project is selected.
        headers: { Authorization: `Bearer ${token}` },
      });
      setApiKeys(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching API keys:', err);
      if (!errorCooldown) {
        setError(err.response?.data?.error || 'Failed to load API keys');
        setErrorCooldown(true);
        setTimeout(() => setErrorCooldown(false), 5000);
      }
    } finally {
      setLoading(false);
    }
  }, [getToken, errorCooldown]);

  const handleDeleteApiKey = async (apiKeyId) => {
    if (!apiKeyId) return;
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    try {
      const token = await getToken();
      await axios.delete(`${AUTH_API_URL}/api/api-keys/${apiKeyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchApiKeys();
    } catch (err) {
      console.error('Error deleting API key:', err);
      setError(err.response?.data?.error || 'Failed to delete API key');
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    const projectIdsToAssign =
      selectedProjectIds.length > 0
        ? selectedProjectIds.map((x) => Number(x)).filter(Boolean)
        : selectedProjectId
          ? [Number(selectedProjectId)]
          : [];

    if (!newKeyName.trim() || projectIdsToAssign.length === 0) {
      setError('Please provide a key name and select one or more projects');
      return;
    }

    setCreatingKey(true);
    try {
      const token = await getToken();
      const response = await axios.post(
        `${AUTH_API_URL}/api/api-keys`,
        {
          reference_name: newKeyName,
          expiration_days: newKeyExpiration,
          project_ids: projectIdsToAssign,
          rate_limits: {
            requests_per_second: rateLimits.requests_per_second ? Number(rateLimits.requests_per_second) : null,
            requests_per_minute: rateLimits.requests_per_minute ? Number(rateLimits.requests_per_minute) : null,
            requests_per_hour: rateLimits.requests_per_hour ? Number(rateLimits.requests_per_hour) : null,
            burst_limit: rateLimits.burst_limit ? Number(rateLimits.burst_limit) : null,
          },
          traffic_policy: {
            daily_quota: trafficPolicy.daily_quota ? Number(trafficPolicy.daily_quota) : null,
            monthly_quota: trafficPolicy.monthly_quota ? Number(trafficPolicy.monthly_quota) : null,
            daily_cost_usd: trafficPolicy.daily_cost_usd ? Number(trafficPolicy.daily_cost_usd) : null,
            monthly_cost_usd: trafficPolicy.monthly_cost_usd ? Number(trafficPolicy.monthly_cost_usd) : null,
            throttling_rules: {},
          },
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNewKeyName('');
      setNewKeyExpiration(30);
      setSelectedProjectIds([]);
      setRateLimits({ requests_per_second: '', requests_per_minute: '', requests_per_hour: '', burst_limit: '' });
      setTrafficPolicy({ daily_quota: '', monthly_quota: '', daily_cost_usd: '', monthly_cost_usd: '' });
      setCreatedToken(response.data?.token || null);
      setShowTokenModal(Boolean(response.data?.token));
      setTokenCopied(false);
      setShowCreateKeyForm(false);
      await fetchApiKeys();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create API key');
    } finally {
      setCreatingKey(false);
    }
  };

  // (project creation UI moved out)

  const canManageKeys = isSystemOwner() || isOrganizationAdmin() || isProjectAdmin();

  if (!canManageKeys) {
    return (
      <div className="api-key-management">
        <div className="error-message">You do not have permission to manage API keys.</div>
      </div>
    );
  }

  return (
    <div className="api-key-management">
      <h2>API Key Management</h2>

      {error && <div className="error-message">⚠️ {error}</div>}
      {isOrganizationAdmin() && (
        <div className="selection-section" style={{ paddingTop: 0 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Organization (from token groups):</label>
            <div style={{ padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              {orgFromToken || 'Missing (your token has no single org group)'}
            </div>
          </div>
        </div>
      )}
      {showTokenModal && createdToken && (
        <div className="api-key-modal-overlay" onClick={() => { setShowTokenModal(false); setCreatedToken(null); }}>
          <div className="api-key-modal" onClick={(e) => e.stopPropagation()}>
            <div className="api-key-modal-header">
              <div>
                <div className="api-key-modal-title">API key created</div>
                <div className="api-key-modal-subtitle">This token is shown only once. Copy it now.</div>
              </div>
              <button
                className="api-key-modal-close"
                type="button"
                onClick={() => {
                  setShowTokenModal(false);
                  setCreatedToken(null);
                }}
              >
                ✕
              </button>
            </div>

            <textarea
              className="api-key-modal-token"
              value={createdToken}
              readOnly
              onFocus={(e) => e.target.select()}
            />

            <div className="api-key-modal-actions">
              <button
                className="submit-button"
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(createdToken);
                    setTokenCopied(true);
                    setTimeout(() => setTokenCopied(false), 1500);
                  } catch {
                    // Fallback: select text for manual copy
                    const el = document.querySelector('.api-key-modal-token');
                    el?.focus?.();
                    el?.select?.();
                  }
                }}
              >
                {tokenCopied ? 'Copied' : 'Copy'}
              </button>
              <button
                className="api-key-modal-secondary"
                type="button"
                onClick={() => {
                  setShowTokenModal(false);
                  setCreatedToken(null);
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="selection-section">
        {!isOrganizationAdmin() && (
          <div className="form-group">
            <label>Organization:</label>
            <select
              value={selectedOrgId}
              onChange={(e) => {
                setSelectedOrgId(e.target.value);
                setSelectedProjectId('');
              }}
            >
              <option value="">Select Organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Project:</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={!isOrganizationAdmin() && !selectedOrgId}
          >
            <option value="">Select Project</option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id}>
                {proj.name}
              </option>
            ))}
          </select>
        </div>

        {(selectedProjectId || projects.length > 0) && (
          <button
            onClick={() => setShowCreateKeyForm(!showCreateKeyForm)}
            className="create-key-button"
          >
            {showCreateKeyForm ? 'Cancel' : '+ Create API Key'}
          </button>
        )}
      </div>

      {/* Project creation moved to Organization view for OAs */}

      {showCreateKeyForm && projects.length > 0 && (
        <form onSubmit={handleCreateKey} className="api-key-card">
          <div className="api-key-card-header">
            <div>
              <div className="api-key-card-title">Create API Key</div>
              <div className="api-key-card-subtitle">Configure key details, projects, and optional policies.</div>
            </div>
            <button type="button" className="api-key-card-close" onClick={() => setShowCreateKeyForm(false)}>
              Close
            </button>
          </div>

          <div className="api-key-card-grid">
            <div className="api-key-section">
              <div className="api-key-section-title">Basics</div>
              <div className="api-key-field">
                <label>Reference name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                  placeholder="e.g., production-api-key"
                />
              </div>
              <div className="api-key-field">
                <label>Expiration (days)</label>
                <input
                  type="number"
                  value={newKeyExpiration}
                  onChange={(e) => setNewKeyExpiration(parseInt(e.target.value) || 30)}
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="api-key-section">
              <div className="api-key-section-title">Projects</div>
              <div className="api-key-field">
                <label>Assign to projects</label>
                <select
                  multiple
                  value={selectedProjectIds}
                  onChange={(e) => setSelectedProjectIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
                  className="api-key-multiselect"
                >
                {projects.map((p) => {
                  const used = projectIdsWithKeys().has(String(p.id));
                  return (
                    <option key={p.id} value={p.id} disabled={used}>
                      {p.name}{used ? ' (already has API key)' : ''}
                    </option>
                  );
                })}
                </select>
                <div className="api-key-hint">Hold Cmd/Ctrl to select multiple</div>
              </div>
            </div>

            <div className="api-key-section">
              <div className="api-key-section-title">Rate limits (optional)</div>
              <div className="api-key-field-grid">
                <div className="api-key-field">
                  <label>Requests / sec</label>
                  <input
                    inputMode="numeric"
                    placeholder="e.g., 5"
                    value={rateLimits.requests_per_second}
                    onChange={(e) => setRateLimits((s) => ({ ...s, requests_per_second: e.target.value }))}
                  />
                </div>
                <div className="api-key-field">
                  <label>Requests / min</label>
                  <input
                    inputMode="numeric"
                    placeholder="e.g., 300"
                    value={rateLimits.requests_per_minute}
                    onChange={(e) => setRateLimits((s) => ({ ...s, requests_per_minute: e.target.value }))}
                  />
                </div>
                <div className="api-key-field">
                  <label>Requests / hour</label>
                  <input
                    inputMode="numeric"
                    placeholder="e.g., 10000"
                    value={rateLimits.requests_per_hour}
                    onChange={(e) => setRateLimits((s) => ({ ...s, requests_per_hour: e.target.value }))}
                  />
                </div>
                <div className="api-key-field">
                  <label>Burst limit</label>
                  <input
                    inputMode="numeric"
                    placeholder="e.g., 20"
                    value={rateLimits.burst_limit}
                    onChange={(e) => setRateLimits((s) => ({ ...s, burst_limit: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="api-key-section">
              <div className="api-key-section-title">Traffic policy (optional)</div>
              <div className="api-key-field-grid">
                <div className="api-key-field">
                  <label>Daily quota</label>
                  <input
                    inputMode="numeric"
                    value={trafficPolicy.daily_quota}
                    onChange={(e) => setTrafficPolicy((s) => ({ ...s, daily_quota: e.target.value }))}
                  />
                </div>
                <div className="api-key-field">
                  <label>Monthly quota</label>
                  <input
                    inputMode="numeric"
                    value={trafficPolicy.monthly_quota}
                    onChange={(e) => setTrafficPolicy((s) => ({ ...s, monthly_quota: e.target.value }))}
                  />
                </div>
                <div className="api-key-field">
                  <label>Daily cost (USD)</label>
                  <input
                    inputMode="decimal"
                    value={trafficPolicy.daily_cost_usd}
                    onChange={(e) => setTrafficPolicy((s) => ({ ...s, daily_cost_usd: e.target.value }))}
                  />
                </div>
                <div className="api-key-field">
                  <label>Monthly cost (USD)</label>
                  <input
                    inputMode="decimal"
                    value={trafficPolicy.monthly_cost_usd}
                    onChange={(e) => setTrafficPolicy((s) => ({ ...s, monthly_cost_usd: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="api-key-card-actions">
            <button type="submit" disabled={creatingKey} className="submit-button">
              {creatingKey ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </form>
      )}

      {(selectedProjectId || isOrganizationAdmin()) && (
        <div className="api-keys-list">
          <h3>{selectedProjectId ? 'API Keys for Selected Project' : 'API Keys for Your Organization'}</h3>
          {loading ? (
            <div className="loading">Loading API keys...</div>
          ) : apiKeys.length === 0 ? (
            <div className="no-keys">No API keys found for this project.</div>
          ) : (
            <table className="api-keys-table">
              <thead>
                <tr>
                  <th>Reference Name</th>
                  <th>Created By</th>
                  <th>Created At</th>
                  <th>Expires At</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(selectedProjectId
                  ? apiKeys.filter((k) => Array.isArray(k.project_ids) && k.project_ids.map(String).includes(String(selectedProjectId)))
                  : apiKeys
                ).map((key) => (
                  <tr key={key.id}>
                    <td>{key.reference_name}</td>
                    <td>{key.created_by}</td>
                    <td>{new Date(key.created_at).toLocaleString()}</td>
                    <td>
                      {key.expires_at
                        ? new Date(key.expires_at).toLocaleString()
                        : 'Never'}
                    </td>
                    <td>
                      <span
                        className={`status-badge ${
                          key.is_active && (!key.expires_at || new Date(key.expires_at) > new Date())
                            ? 'active'
                            : 'inactive'
                        }`}
                      >
                        {key.is_active &&
                        (!key.expires_at || new Date(key.expires_at) > new Date())
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="api-key-actions">
                        <button
                          type="button"
                          className="api-key-delete-btn"
                          onClick={() => handleDeleteApiKey(key.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default ApiKeyManagement;
