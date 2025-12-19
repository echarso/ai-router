import { useEffect, useMemo, useState, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import './OrganizationManagement.css';
import './ApiKeyManagement.css';

const RAW_AUTH_API_URL = import.meta.env.VITE_AUTH_API_URL;
const AUTH_API_URL = ((typeof RAW_AUTH_API_URL === 'string' && RAW_AUTH_API_URL.includes('localhost:3002'))
  ? '/auth-api'
  : (RAW_AUTH_API_URL || '/auth-api'))
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export default function OrganizationPanel() {
  const { getToken, isOrganizationAdmin, user } = useAuth();
  const orgFromToken = Array.isArray(user?.groups) && user.groups.length === 1 ? user.groups[0] : null;

  const [projects, setProjects] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  const canUse = isOrganizationAdmin();

  const fetchProjects = useCallback(async () => {
    try {
      const token = await getToken();
      const response = await axios.get(`${AUTH_API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjects(response.data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err.response?.data?.error || 'Failed to load projects');
    }
  }, [getToken]);

  const fetchApiKeys = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await axios.get(`${AUTH_API_URL}/api/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setApiKeys(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching API keys:', err);
      setError(err.response?.data?.error || 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!canUse) return;
    fetchProjects();
    fetchApiKeys();
  }, [canUse, fetchProjects, fetchApiKeys]);

  const projectIdsWithKeys = useMemo(() => {
    const s = new Set();
    for (const k of apiKeys || []) {
      const ids = Array.isArray(k.project_ids) ? k.project_ids : [];
      for (const pid of ids) s.add(String(pid));
    }
    return s;
  }, [apiKeys]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const token = await getToken();
      await axios.post(
        `${AUTH_API_URL}/api/projects`,
        { name: newProjectName.trim(), description: newProjectDescription },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewProjectName('');
      setNewProjectDescription('');
      await fetchProjects();
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err.response?.data?.error || 'Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  if (!canUse) {
    return (
      <div className="organization-management">
        <div className="error-message">Only Organization Admins can access this view.</div>
      </div>
    );
  }

  return (
    <div className="organization-management">
      <h2>Organization</h2>

      {error && <div className="error-message">⚠️ {error}</div>}

      <div className="selection-section" style={{ paddingTop: 0 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Organization (from token groups):</label>
          <div style={{ padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: 8 }}>
            {orgFromToken || 'Missing (your token has no single org group)'}
          </div>
        </div>
      </div>

      <div className="assign-user-section">
        <h3>Create Project</h3>
        <form onSubmit={handleCreateProject} className="create-org-form">
          <div className="form-group">
            <label>Project name:</label>
            <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Description:</label>
            <input value={newProjectDescription} onChange={(e) => setNewProjectDescription(e.target.value)} />
          </div>
          <button type="submit" disabled={creatingProject} className="submit-button">
            {creatingProject ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      </div>

      <div className="organizations-list org-panel-projects">
        <h3>Projects</h3>
        {projects.length === 0 ? (
          <div className="no-orgs">No projects yet.</div>
        ) : (
          <table className="organizations-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Description</th>
                <th>Has API key?</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.description || '-'}</td>
                  <td>{projectIdsWithKeys.has(String(p.id)) ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="api-keys-list">
        <h3>API Keys (Organization)</h3>
        {loading ? (
          <div className="loading">Loading API keys...</div>
        ) : apiKeys.length === 0 ? (
          <div className="no-keys">No API keys yet.</div>
        ) : (
          <table className="api-keys-table">
            <thead>
              <tr>
                <th>Reference Name</th>
                <th>Created By</th>
                <th>Projects</th>
                <th>Created At</th>
                <th>Expires At</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((k) => (
                <tr key={k.id}>
                  <td>{k.reference_name}</td>
                  <td>{k.created_by}</td>
                  <td>{Array.isArray(k.project_ids) ? k.project_ids.join(', ') : '-'}</td>
                  <td>{new Date(k.created_at).toLocaleString()}</td>
                  <td>{k.expires_at ? new Date(k.expires_at).toLocaleString() : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

