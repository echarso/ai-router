const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5007;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'platform_db',
  user: process.env.DB_USER || 'platform_user',
  password: process.env.DB_PASSWORD || 'platform_pass',
});

// Keycloak configuration
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8080';
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'bestai';
const JWKS_URI = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const EXPECTED_ISSUER = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;
const KEYCLOAK_ADMIN = process.env.KEYCLOAK_ADMIN || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD || 'admin';

// OpenBao configuration
const OPENBAO_URL = process.env.OPENBAO_URL || 'http://localhost:8200';
const OPENBAO_TOKEN = process.env.OPENBAO_TOKEN || 'root-token';
const OPENBAO_MOUNT_PATH = process.env.OPENBAO_MOUNT_PATH || 'secret';

// JWKS client for Keycloak token verification
const client = jwksClient({
  jwksUri: JWKS_URI,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function isSystemAdmin(userRoles = []) {
  // Backwards compatibility: "system-owner" previously acted as SA
  return userRoles.includes('system-admin') || userRoles.includes('system-owner');
}

function isOrgAdmin(userRoles = []) {
  return userRoles.includes('organization-admin');
}

function getOrgNameFromTokenClaims(decoded) {
  // Requirement: OA token must include org name as a group claim.
  // We support Keycloak "groups" claim (array of group names/paths).
  const groups = decoded?.groups;
  if (!Array.isArray(groups) || groups.length === 0) return null;

  // If groups are full paths like "/volvo", strip leading "/"
  const normalized = groups.map((g) => String(g).replace(/^\//, '')).filter(Boolean);
  if (normalized.length === 0) return null;

  // OA must belong to exactly one org => if multiple, treat as invalid context for OA flows.
  if (normalized.length > 1) return null;
  return normalized[0];
}

async function ensureOrgExistsAndBindOA({ orgName, userId }) {
  if (!orgName) return null;

  // Ensure org exists
  const inserted = await pool.query(
    `INSERT INTO organizations (name, description)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [orgName, 'Auto-created from Keycloak groups claim']
  );
  const orgId = inserted.rows[0]?.id;
  if (!orgId) return null;

  // Ensure OA binding in DB (OA must be exactly one org)
  if (userId) {
    await pool.query(`DELETE FROM user_organizations WHERE user_id = $1 AND role = 'OA'`, [userId]);
    await pool.query(
      `INSERT INTO user_organizations (user_id, organization_id, role)
       VALUES ($1, $2, 'OA')
       ON CONFLICT DO NOTHING`,
      [userId, orgId]
    );
  }

  return orgId;
}

async function getKeycloakAdminToken() {
  const adminTokenResponse = await axios.post(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: 'password',
      client_id: 'admin-cli',
      username: KEYCLOAK_ADMIN,
      password: KEYCLOAK_ADMIN_PASSWORD,
    })
  );
  return adminTokenResponse.data.access_token;
}

async function ensureKeycloakGroup(adminToken, groupName) {
  const groupsResp = await axios.get(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/groups`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  const existing = (groupsResp.data || []).find((g) => g.name === groupName);
  if (existing) return existing;

  await axios.post(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/groups`,
    { name: groupName },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const groupsResp2 = await axios.get(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/groups`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  return (groupsResp2.data || []).find((g) => g.name === groupName);
}

async function setUserSingleOrgGroup(adminToken, userId, orgName) {
  // Remove all groups, then add only org group (enforces OA single-org rule)
  const currentGroupsResp = await axios.get(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/groups`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  for (const g of currentGroupsResp.data || []) {
    await axios.delete(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/groups/${g.id}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
  }

  const orgGroup = await ensureKeycloakGroup(adminToken, orgName);
  if (!orgGroup?.id) throw new Error(`Failed to ensure Keycloak group '${orgName}'`);

  await axios.put(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/groups/${orgGroup.id}`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
}

async function ensureUserHasRealmRole(adminToken, userId, roleName) {
  const roleResp = await axios.get(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/roles/${roleName}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const role = roleResp.data;
  if (!role?.id) throw new Error(`Role '${roleName}' not found`);

  await axios.post(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
    [{ id: role.id, name: role.name }],
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
}

async function writeOpenBaoKV(pathSuffix, data) {
  await axios.post(
    `${OPENBAO_URL}/v1/${OPENBAO_MOUNT_PATH}/data/${pathSuffix}`,
    { data },
    { headers: { 'X-Vault-Token': OPENBAO_TOKEN } }
  );
}

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Middleware to verify Keycloak JWT token
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('No token provided in request');
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  
  if (!token || token === 'undefined' || token === 'null') {
    console.error('Invalid token format:', token);
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const expectedIssuer = EXPECTED_ISSUER;

  jwt.verify(token, getKey, {
    algorithms: ['RS256'],
    issuer: expectedIssuer,
    ignoreExpiration: false,
  }, (err, decoded) => {
    if (err) {
      console.error('Token verification failed:', {
        error: err.message,
        name: err.name,
        expectedIssuer,
        tokenIssuer: decoded?.iss,
      });
      
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', details: 'Please refresh your session' });
      }
      if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'Invalid token', details: err.message });
      }
      
      return res.status(401).json({ error: 'Invalid token', details: err.message });
    }
    
    req.user = decoded;
    req.userId = decoded.sub;
    req.userRoles = decoded.realm_access?.roles || [];
    req.orgName = getOrgNameFromTokenClaims(decoded);
    next();
  });
}

console.log('🔐 Auth service Keycloak config:', {
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  EXPECTED_ISSUER,
  JWKS_URI,
});

// Helper function to check if user has role
function hasRole(userRoles, role) {
  return userRoles.includes(role);
}

// Helper function to create OpenBao token
async function createOpenBaoToken(apiKeyId, organizationId, projectIds, expirationDays, rateLimits, trafficPolicy) {
  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + expirationDays);
    
    const tokenData = {
      api_key_id: apiKeyId,
      organization_id: organizationId,
      project_ids: projectIds,
      created_at: new Date().toISOString(),
      expires_at: expirationDate.toISOString(),
      rate_limits: rateLimits || null,
      traffic_policy: trafficPolicy || null,
    };
    
    // Generate a unique token
    const token = `ba_${Buffer.from(`${apiKeyId}-${Date.now()}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
    
    // Store in OpenBao
    await writeOpenBaoKV(`api-keys/${apiKeyId}`, { ...tokenData, token });
    
    return { token };
  } catch (error) {
    console.error('Error creating OpenBao token:', error);
    // Fallback: generate token anyway
    const token = `ba_${Buffer.from(`${apiKeyId}-${Date.now()}`).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;
    return { token };
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ==================== SYSTEM ADMIN (SA) ====================
// Users live in Keycloak; SA can list/create users and assign them to orgs.

app.get('/api/admin/users', verifyToken, async (req, res) => {
  try {
    if (!isSystemAdmin(req.userRoles)) {
      return res.status(403).json({ error: 'Only System Admins can list users' });
    }

    const adminToken = await getKeycloakAdminToken();
    const { search } = req.query;
    const url = search
      ? `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?search=${encodeURIComponent(search)}`
      : `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`;

    const usersResp = await axios.get(url, { headers: { Authorization: `Bearer ${adminToken}` } });
    const users = usersResp.data || [];

    // enrich with groups + realm roles
    const enriched = [];
    for (const u of users) {
      const [groupsResp, rolesResp] = await Promise.all([
        axios.get(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${u.id}/groups`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        axios.get(`${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${u.id}/role-mappings/realm`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      ]);

      enriched.push({
        id: u.id,
        username: u.username,
        email: u.email,
        enabled: u.enabled,
        groups: (groupsResp.data || []).map((g) => g.name),
        roles: (rolesResp.data || []).map((r) => r.name),
      });
    }

    res.json(enriched);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

app.post('/api/admin/users', verifyToken, async (req, res) => {
  try {
    if (!isSystemAdmin(req.userRoles)) {
      return res.status(403).json({ error: 'Only System Admins can create users' });
    }

    const { username, password, email, organization_id, organization_name, role } = req.body;
    const desiredRole = role || 'organization-admin';

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    // Resolve organization
    let orgId = organization_id ? Number(organization_id) : null;
    let orgName = organization_name ? String(organization_name) : null;

    if (!orgId && !orgName) {
      return res.status(400).json({ error: 'organization_id or organization_name is required' });
    }

    if (!orgId && orgName) {
      const existing = await pool.query('SELECT id FROM organizations WHERE name = $1', [orgName]);
      orgId = existing.rows[0]?.id || null;
      if (!orgId) {
        const created = await pool.query(
          'INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING id',
          [orgName, 'Created via SA user creation']
        );
        orgId = created.rows[0].id;
      }
    }

    if (orgId && !orgName) {
      const existing = await pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
      orgName = existing.rows[0]?.name || null;
      if (!orgName) return res.status(404).json({ error: 'Organization not found' });
    }

    const adminToken = await getKeycloakAdminToken();

    // Create user in Keycloak
    await axios.post(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users`,
      {
        username,
        email: email || `${username}@example.com`,
        enabled: true,
        emailVerified: true,
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // fetch created user id
    const usersResp = await axios.get(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?username=${encodeURIComponent(username)}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const user = (usersResp.data || [])[0];
    if (!user?.id) return res.status(500).json({ error: 'Failed to locate created user' });

    // set password
    await axios.put(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${user.id}/reset-password`,
      { type: 'password', value: password, temporary: false },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    // assign role
    await ensureUserHasRealmRole(adminToken, user.id, desiredRole);

    // enforce OA -> single org group membership
    await setUserSingleOrgGroup(adminToken, user.id, orgName);

    // reflect in DB as OA membership
    await pool.query(`DELETE FROM user_organizations WHERE user_id = $1 AND role = 'OA'`, [user.id]);
    await pool.query(
      `INSERT INTO user_organizations (user_id, organization_id, role)
       VALUES ($1, $2, 'OA')
       ON CONFLICT DO NOTHING`,
      [user.id, orgId]
    );

    res.status(201).json({ id: user.id, username, organization: orgName, role: desiredRole });
  } catch (error) {
    console.error('Error creating user:', error);
    // Keycloak returns 409 for existing username
    if (error?.response?.status === 409) {
      return res.status(409).json({ error: 'User already exists' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ==================== ORGANIZATIONS ====================

// Get organizations (filtered by role)
app.get('/api/organizations', verifyToken, async (req, res) => {
  try {
    const userRoles = req.userRoles;
    
    if (isSystemAdmin(userRoles)) {
      // System Admin sees all organizations
      const result = await pool.query('SELECT * FROM organizations ORDER BY created_at DESC');
      res.json(result.rows);
    } else if (isOrgAdmin(userRoles)) {
      // OA must be in exactly one org, provided via token claim (groups)
      if (!req.orgName) {
        return res.status(403).json({ error: 'Organization missing in token groups claim' });
      }
      await ensureOrgExistsAndBindOA({ orgName: req.orgName, userId: req.userId });
      const result = await pool.query('SELECT * FROM organizations WHERE name = $1', [req.orgName]);
      res.json(result.rows);
    } else {
      res.status(403).json({ error: 'Insufficient permissions' });
    }
  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Create organization (System Owner only)
app.post('/api/organizations', verifyToken, async (req, res) => {
  try {
    if (!isSystemAdmin(req.userRoles)) {
      return res.status(403).json({ error: 'Only System Admins can create organizations' });
    }
    
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }
    
    const result = await pool.query(
      'INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || '']
    );
    // Ensure org group exists in Keycloak
    try {
      const adminToken = await getKeycloakAdminToken();
      await ensureKeycloakGroup(adminToken, name);
    } catch (e) {
      console.warn('Warning: could not create/ensure Keycloak group for org:', e?.message || e);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Organization with this name already exists' });
    } else {
      console.error('Error creating organization:', error);
      res.status(500).json({ error: 'Failed to create organization' });
    }
  }
});

// Delete organization (System Owner only)
app.delete('/api/organizations/:orgId', verifyToken, async (req, res) => {
  try {
    if (!hasRole(req.userRoles, 'system-owner')) {
      return res.status(403).json({ error: 'Only System Owners can delete organizations' });
    }
    
    const { orgId } = req.params;
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    res.json({ message: 'Organization deleted successfully' });
  } catch (error) {
    console.error('Error deleting organization:', error);
    res.status(500).json({ error: 'Failed to delete organization' });
  }
});

// Get users for organization (System Owner only)
app.get('/api/organizations/:orgId/users', verifyToken, async (req, res) => {
  try {
    if (!hasRole(req.userRoles, 'system-owner')) {
      return res.status(403).json({ error: 'Only System Owners can view organization users' });
    }
    
    const { orgId } = req.params;
    const result = await pool.query(
      `SELECT uo.*, uo.user_id::text as username 
       FROM user_organizations uo 
       WHERE uo.organization_id = $1 
       ORDER BY uo.created_at DESC`,
      [orgId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching organization users:', error);
    res.status(500).json({ error: 'Failed to fetch organization users' });
  }
});

// Assign user to organization (System Owner only)
app.post('/api/organizations/:orgId/assign-user', verifyToken, async (req, res) => {
  try {
    if (!isSystemAdmin(req.userRoles)) {
      return res.status(403).json({ error: 'Only System Admins can assign users to organizations' });
    }
    
    const { orgId } = req.params;
    const { username, role } = req.body;
    
    if (!username || !role) {
      return res.status(400).json({ error: 'Username and role are required' });
    }
    
    if (!['OA', 'PA'].includes(role)) {
      return res.status(400).json({ error: 'Role must be OA (Organization Admin) or PA (Project Admin)' });
    }
    
    const adminToken = await getKeycloakAdminToken();
    
    // Find user by username in Keycloak
    const usersResponse = await axios.get(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?username=${username}`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    
    if (!usersResponse.data || usersResponse.data.length === 0) {
      return res.status(404).json({ error: `User '${username}' not found in Keycloak` });
    }
    
    const keycloakUser = usersResponse.data[0];
    const userId = keycloakUser.id;

    // Ensure Keycloak org group exists and set user group membership for OA
    if (role === 'OA') {
      const orgResult = await pool.query('SELECT name FROM organizations WHERE id = $1', [orgId]);
      const orgName = orgResult.rows[0]?.name;
      if (!orgName) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      await ensureUserHasRealmRole(adminToken, userId, 'organization-admin');
      await setUserSingleOrgGroup(adminToken, userId, orgName);
    }
    
    // Enforce: OA belongs to exactly one organization
    if (role === 'OA') {
      await pool.query(`DELETE FROM user_organizations WHERE user_id = $1 AND role = 'OA'`, [userId]);
    }

    await pool.query(
      `INSERT INTO user_organizations (user_id, organization_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, organization_id, role) DO NOTHING`,
      [userId, orgId, role]
    );
    
    res.json({ message: `User ${username} assigned to organization successfully` });
  } catch (error) {
    console.error('Error assigning user to organization:', error);
    res.status(500).json({ error: 'Failed to assign user to organization' });
  }
});

// ==================== PROJECTS ====================

// Get projects
app.get('/api/projects', verifyToken, async (req, res) => {
  try {
    const userRoles = req.userRoles;

    if (isSystemAdmin(userRoles)) {
      const { organization_id } = req.query;
      const params = [];
      let query =
        'SELECT p.*, o.name as organization_name FROM projects p JOIN organizations o ON p.organization_id = o.id';
      if (organization_id) {
        query += ' WHERE p.organization_id = $1';
        params.push(organization_id);
      }
      query += ' ORDER BY p.created_at DESC';
      const result = await pool.query(query, params);
      return res.json(result.rows);
    }

    if (isOrgAdmin(userRoles)) {
      if (!req.orgName) {
        return res.status(403).json({ error: 'Organization missing in token groups claim' });
      }
      await ensureOrgExistsAndBindOA({ orgName: req.orgName, userId: req.userId });
      const result = await pool.query(
        `SELECT p.*, o.name as organization_name
         FROM projects p
         JOIN organizations o ON p.organization_id = o.id
         WHERE o.name = $1
         ORDER BY p.created_at DESC`,
        [req.orgName]
      );
      return res.json(result.rows);
    }

    // Project Admin (legacy) - keep existing behavior via user_projects join
    if (hasRole(userRoles, 'project-admin')) {
      const result = await pool.query(
        `SELECT p.*, o.name as organization_name
         FROM projects p
         JOIN organizations o ON p.organization_id = o.id
         INNER JOIN user_projects up ON p.id = up.project_id
         WHERE up.user_id = $1
         ORDER BY p.created_at DESC`,
        [req.userId]
      );
      return res.json(result.rows);
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create project
app.post('/api/projects', verifyToken, async (req, res) => {
  try {
    const userRoles = req.userRoles;

    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (isSystemAdmin(userRoles)) {
      const { organization_id } = req.body;
      if (!organization_id) {
        return res.status(400).json({ error: 'organization_id is required for system admin' });
      }
      const result = await pool.query(
        'INSERT INTO projects (name, description, organization_id) VALUES ($1, $2, $3) RETURNING *',
        [name, description || '', organization_id]
      );
      return res.status(201).json(result.rows[0]);
    }

    if (isOrgAdmin(userRoles)) {
      if (!req.orgName) {
        return res.status(403).json({ error: 'Organization missing in token groups claim' });
      }
      const orgId = await ensureOrgExistsAndBindOA({ orgName: req.orgName, userId: req.userId });
      if (!orgId) return res.status(500).json({ error: 'Failed to resolve organization' });
      const result = await pool.query(
        'INSERT INTO projects (name, description, organization_id) VALUES ($1, $2, $3) RETURNING *',
        [name, description || '', orgId]
      );
      return res.status(201).json(result.rows[0]);
    }

    return res.status(403).json({ error: 'Only System Admins and Organization Admins can create projects' });
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Project with this name already exists in this organization' });
    } else {
      console.error('Error creating project:', error);
      res.status(500).json({ error: 'Failed to create project' });
    }
  }
});

// ==================== API KEYS ====================

// Get API keys
app.get('/api/api-keys', verifyToken, async (req, res) => {
  try {
    const userRoles = req.userRoles;
    const { project_id } = req.query;

    if (isSystemAdmin(userRoles)) {
      const params = [];
      let where = '';
      if (project_id) {
        where = 'WHERE (ak.project_id = $1 OR EXISTS (SELECT 1 FROM api_key_projects akp WHERE akp.api_key_id = ak.id AND akp.project_id = $1))';
        params.push(project_id);
      }

      const result = await pool.query(
        `SELECT ak.*,
                o.name as organization_name,
                COALESCE(array_agg(DISTINCT akp.project_id) FILTER (WHERE akp.project_id IS NOT NULL), ARRAY[]::int[]) as project_ids
         FROM api_keys ak
         LEFT JOIN organizations o ON ak.organization_id = o.id
         LEFT JOIN api_key_projects akp ON akp.api_key_id = ak.id
         ${where}
         GROUP BY ak.id, o.name
         ORDER BY ak.created_at DESC`,
        params
      );
      return res.json(result.rows);
    }

    if (isOrgAdmin(userRoles)) {
      if (!req.orgName) {
        return res.status(403).json({ error: 'Organization missing in token groups claim' });
      }
      await ensureOrgExistsAndBindOA({ orgName: req.orgName, userId: req.userId });

      const params = [req.orgName];
      let extra = '';
      if (project_id) {
        extra =
          ' AND (ak.project_id = $2 OR EXISTS (SELECT 1 FROM api_key_projects akp2 WHERE akp2.api_key_id = ak.id AND akp2.project_id = $2))';
        params.push(project_id);
      }

      const result = await pool.query(
        `SELECT ak.*,
                o.name as organization_name,
                COALESCE(array_agg(DISTINCT akp.project_id) FILTER (WHERE akp.project_id IS NOT NULL), ARRAY[]::int[]) as project_ids
         FROM api_keys ak
         JOIN organizations o ON ak.organization_id = o.id
         LEFT JOIN api_key_projects akp ON akp.api_key_id = ak.id
         WHERE o.name = $1 ${extra}
         GROUP BY ak.id, o.name
         ORDER BY ak.created_at DESC`,
        params
      );
      return res.json(result.rows);
    }

    return res.status(403).json({ error: 'Insufficient permissions' });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create API key
app.post('/api/api-keys', verifyToken, async (req, res) => {
  try {
    const userRoles = req.userRoles;

    const {
      reference_name,
      expiration_days,
      project_id,
      project_ids,
      rate_limits,
      traffic_policy,
    } = req.body;

    if (!reference_name) {
      return res.status(400).json({ error: 'reference_name is required' });
    }

    const expDays = Number.isFinite(Number(expiration_days)) ? Number(expiration_days) : 30;

    const requestedProjectIds = Array.isArray(project_ids)
      ? project_ids.map((x) => Number(x)).filter((x) => Number.isFinite(x))
      : project_id
        ? [Number(project_id)]
        : [];

    if (requestedProjectIds.length === 0) {
      return res.status(400).json({ error: 'project_id or project_ids is required' });
    }

    // Determine org based on role
    let orgId = null;
    if (isOrgAdmin(userRoles)) {
      if (!req.orgName) {
        return res.status(403).json({ error: 'Organization missing in token groups claim' });
      }
      orgId = await ensureOrgExistsAndBindOA({ orgName: req.orgName, userId: req.userId });
      if (!orgId) return res.status(500).json({ error: 'Failed to resolve organization' });
    }

    // Validate projects belong to org
    const projRows = await pool.query(
      `SELECT p.id, p.organization_id FROM projects p WHERE p.id = ANY($1::int[])`,
      [requestedProjectIds]
    );
    if ((projRows.rows || []).length !== requestedProjectIds.length) {
      return res.status(404).json({ error: 'One or more projects not found' });
    }

    // Enforce: each project can have only one API key assigned
    const existingAssignments = await pool.query(
      `SELECT akp.project_id, akp.api_key_id
       FROM api_key_projects akp
       WHERE akp.project_id = ANY($1::int[])`,
      [requestedProjectIds]
    );
    if ((existingAssignments.rows || []).length > 0) {
      const projectsBlocked = existingAssignments.rows.map((r) => r.project_id).join(', ');
      return res.status(409).json({ error: `One API key per project. These projects already have a key: ${projectsBlocked}` });
    }

    const orgIdsInProjects = [...new Set(projRows.rows.map((r) => r.organization_id))];
    if (orgIdsInProjects.length !== 1) {
      return res.status(400).json({ error: 'Projects must belong to a single organization' });
    }
    const derivedOrgId = orgIdsInProjects[0];
    if (orgId && orgId !== derivedOrgId) {
      return res.status(403).json({ error: 'Project(s) not in your organization' });
    }
    orgId = derivedOrgId;

    const primaryProjectId = requestedProjectIds[0];

    const expiresAt = new Date(Date.now() + expDays * 24 * 60 * 60 * 1000);

    const result = await pool.query(
      `INSERT INTO api_keys (reference_name, project_id, organization_id, created_by, expiration_days, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [reference_name, primaryProjectId, orgId, (req.user?.preferred_username || req.userId), expDays, expiresAt]
    );

    const apiKey = result.rows[0];

    // project assignments
    for (const pid of requestedProjectIds) {
      await pool.query(
        `INSERT INTO api_key_projects (api_key_id, project_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [apiKey.id, pid]
      );
    }

    // persist policies in DB (simple default names)
    if (rate_limits) {
      await pool.query(
        `INSERT INTO rate_limit_policies (api_key_id, policy_name, requests_per_second, requests_per_minute, requests_per_hour, burst_limit)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (api_key_id, policy_name) DO NOTHING`,
        [
          apiKey.id,
          'default',
          rate_limits.requests_per_second ?? null,
          rate_limits.requests_per_minute ?? null,
          rate_limits.requests_per_hour ?? null,
          rate_limits.burst_limit ?? null,
        ]
      );
    }

    if (traffic_policy) {
      try {
        await pool.query(
          `INSERT INTO traffic_policies (api_key_id, policy_name, daily_quota, monthly_quota, daily_cost_usd, monthly_cost_usd, throttling_rules)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (api_key_id, policy_name) DO NOTHING`,
          [
            apiKey.id,
            'default',
            traffic_policy.daily_quota ?? null,
            traffic_policy.monthly_quota ?? null,
            traffic_policy.daily_cost_usd ?? null,
            traffic_policy.monthly_cost_usd ?? null,
            JSON.stringify(traffic_policy.throttling_rules || {}),
          ]
        );
      } catch (e) {
        // Backwards-compat: if DB hasn't been migrated yet, fall back to old columns
        if (e?.code === '42703') {
          await pool.query(
            `INSERT INTO traffic_policies (api_key_id, policy_name, daily_quota, monthly_quota, throttling_rules)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (api_key_id, policy_name) DO NOTHING`,
            [
              apiKey.id,
              'default',
              traffic_policy.daily_quota ?? null,
              traffic_policy.monthly_quota ?? null,
              JSON.stringify(traffic_policy.throttling_rules || {}),
            ]
          );
        } else {
          throw e;
        }
      }
    }

    const generatedToken = await createOpenBaoToken(
      apiKey.id,
      orgId,
      requestedProjectIds,
      expDays,
      rate_limits,
      traffic_policy
    );

    return res.status(201).json({
      ...apiKey,
      project_ids: requestedProjectIds,
      token: generatedToken.token,
    });
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'API key with this reference name already exists' });
    } else {
      console.error('Error creating API key:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }
});

// Delete (revoke) API key
app.delete('/api/api-keys/:apiKeyId', verifyToken, async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const userRoles = req.userRoles;

    // Determine key org context
    const keyRow = await pool.query(
      `SELECT ak.id,
              COALESCE(ak.organization_id, p.organization_id) AS organization_id
       FROM api_keys ak
       LEFT JOIN projects p ON p.id = ak.project_id
       WHERE ak.id = $1`,
      [apiKeyId]
    );

    if (keyRow.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const orgId = keyRow.rows[0].organization_id;

    if (isSystemAdmin(userRoles)) {
      // ok
    } else if (isOrgAdmin(userRoles)) {
      if (!req.orgName) {
        return res.status(403).json({ error: 'Organization missing in token groups claim' });
      }
      await ensureOrgExistsAndBindOA({ orgName: req.orgName, userId: req.userId });
      const orgCheck = await pool.query('SELECT id FROM organizations WHERE name = $1', [req.orgName]);
      const myOrgId = orgCheck.rows[0]?.id;
      if (!myOrgId || String(myOrgId) !== String(orgId)) {
        return res.status(403).json({ error: 'You can only delete API keys in your organization' });
      }
    } else {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    // Hard-delete row (cascades to policies + api_key_projects)
    await pool.query('DELETE FROM api_keys WHERE id = $1', [apiKeyId]);

    // Delete secret from OpenBao (best-effort)
    try {
      await axios.delete(`${OPENBAO_URL}/v1/${OPENBAO_MOUNT_PATH}/metadata/api-keys/${apiKeyId}`, {
        headers: { 'X-Vault-Token': OPENBAO_TOKEN },
      });
    } catch (e) {
      console.warn('Warning: could not delete OpenBao secret for apiKeyId', apiKeyId, e?.message || e);
    }

    return res.json({ message: 'API key deleted' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// Get rate limit policies for API key
app.get('/api/api-keys/:apiKeyId/rate-limit-policies', verifyToken, async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const userRoles = req.userRoles;
    
    // Check access
    const apiKeyCheck = await pool.query(
      `SELECT ak.*, p.organization_id FROM api_keys ak 
       JOIN projects p ON ak.project_id = p.id 
       WHERE ak.id = $1`,
      [apiKeyId]
    );
    
    if (apiKeyCheck.rows.length === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    const apiKey = apiKeyCheck.rows[0];
    
    // Check permissions
    if (!hasRole(userRoles, 'system-owner') && 
        !hasRole(userRoles, 'organization-admin') && 
        !hasRole(userRoles, 'project-admin')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const result = await pool.query(
      'SELECT * FROM rate_limit_policies WHERE api_key_id = $1 ORDER BY created_at DESC',
      [apiKeyId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rate limit policies:', error);
    res.status(500).json({ error: 'Failed to fetch rate limit policies' });
  }
});

// Create rate limit policy
app.post('/api/api-keys/:apiKeyId/rate-limit-policies', verifyToken, async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { policy_name, requests_per_second, requests_per_minute, requests_per_hour, burst_limit } = req.body;
    
    if (!policy_name) {
      return res.status(400).json({ error: 'policy_name is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO rate_limit_policies (api_key_id, policy_name, requests_per_second, requests_per_minute, requests_per_hour, burst_limit)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [apiKeyId, policy_name, requests_per_second, requests_per_minute, requests_per_hour, burst_limit]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Policy with this name already exists for this API key' });
    } else {
      console.error('Error creating rate limit policy:', error);
      res.status(500).json({ error: 'Failed to create rate limit policy' });
    }
  }
});

// Get traffic policies for API key
app.get('/api/api-keys/:apiKeyId/traffic-policies', verifyToken, async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM traffic_policies WHERE api_key_id = $1 ORDER BY created_at DESC',
      [apiKeyId]
    );
    
    const policies = result.rows.map(policy => ({
      ...policy,
      throttling_rules: typeof policy.throttling_rules === 'string'
        ? JSON.parse(policy.throttling_rules)
        : policy.throttling_rules
    }));
    
    res.json(policies);
  } catch (error) {
    console.error('Error fetching traffic policies:', error);
    res.status(500).json({ error: 'Failed to fetch traffic policies' });
  }
});

// Create traffic policy
app.post('/api/api-keys/:apiKeyId/traffic-policies', verifyToken, async (req, res) => {
  try {
    const { apiKeyId } = req.params;
    const { policy_name, daily_quota, monthly_quota, throttling_rules } = req.body;
    
    if (!policy_name) {
      return res.status(400).json({ error: 'policy_name is required' });
    }
    
    const result = await pool.query(
      `INSERT INTO traffic_policies (api_key_id, policy_name, daily_quota, monthly_quota, throttling_rules)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [apiKeyId, policy_name, daily_quota, monthly_quota, JSON.stringify(throttling_rules || {})]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Policy with this name already exists for this API key' });
    } else {
      console.error('Error creating traffic policy:', error);
      res.status(500).json({ error: 'Failed to create traffic policy' });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Auth service running on port ${PORT}`);
  console.log(`Keycloak URL: ${KEYCLOAK_URL}`);
  console.log(`Keycloak Realm: ${KEYCLOAK_REALM}`);
  console.log(`OpenBao URL: ${OPENBAO_URL}`);
});
