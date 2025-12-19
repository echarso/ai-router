#!/bin/bash

set -e

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_NAME="${REALM_NAME:-bestai}"

echo "🔐 Initializing Keycloak Realm: $REALM_NAME"

# Get admin token
echo "🔑 Getting admin token..."
ADMIN_TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=${KEYCLOAK_ADMIN}" \
  -d "password=${KEYCLOAK_ADMIN_PASSWORD}")

ADMIN_TOKEN=$(echo "$ADMIN_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo "❌ Failed to get admin token"
  exit 1
fi

echo "✅ Admin token obtained"

# Check if realm exists
REALM_CHECK=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

if echo "$REALM_CHECK" | grep -q '"realm"'; then
  echo "ℹ️  Realm already exists, updating..."
else
  echo "📝 Creating realm..."
  curl -s -X POST "${KEYCLOAK_URL}/admin/realms" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"realm\": \"${REALM_NAME}\",
      \"enabled\": true,
      \"displayName\": \"API Platform\",
      \"loginTheme\": \"keycloak\",
      \"ssoSessionIdleTimeout\": 1800,
      \"ssoSessionMaxLifespan\": 36000,
      \"accessTokenLifespan\": 3600,
      \"accessTokenLifespanForImplicitFlow\": 3600,
      \"ssoSessionIdleTimeoutRememberMe\": 0,
      \"ssoSessionMaxLifespanRememberMe\": 0,
      \"clientSessionIdleTimeout\": 0,
      \"clientSessionMaxLifespan\": 0,
      \"offlineSessionIdleTimeout\": 2592000,
      \"offlineSessionMaxLifespanEnabled\": false,
      \"clientOfflineSessionIdleTimeout\": 0,
      \"clientOfflineSessionMaxLifespan\": 0
    }" > /dev/null
  echo "✅ Realm created"
fi

# Update realm session settings
curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"ssoSessionIdleTimeout\": 1800,
    \"ssoSessionMaxLifespan\": 36000,
    \"accessTokenLifespan\": 3600,
    \"accessTokenLifespanForImplicitFlow\": 3600
  }" > /dev/null

# Create roles
echo "👥 Creating roles..."
for role in "system-admin" "system-owner" "organization-admin" "project-admin" "simple-user"; do
  curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"${role}\"}" > /dev/null 2>&1 || true
done
echo "✅ Roles created"

# Create frontend client
echo "🔧 Creating frontend client..."
FRONTEND_CLIENT_ID="platform-frontend"
CLIENT_CHECK=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=${FRONTEND_CLIENT_ID}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

CLIENT_ID=$(echo "$CLIENT_CHECK" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$CLIENT_ID" ]; then
  CREATE_RESPONSE=$(curl -s -i -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"clientId\": \"${FRONTEND_CLIENT_ID}\",
      \"enabled\": true,
      \"publicClient\": true,
      \"protocol\": \"openid-connect\",
      \"standardFlowEnabled\": true,
      \"directAccessGrantsEnabled\": true,
      \"redirectUris\": [\"http://localhost:5005/*\", \"http://localhost:5173/*\"],
      \"webOrigins\": [\"http://localhost:5005\", \"http://localhost:5173\", \"+\"]
    }")
  
  CLIENT_ID=$(echo "$CREATE_RESPONSE" | grep -i "location:" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
  
  if [ -z "$CLIENT_ID" ]; then
    CLIENT_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients?clientId=${FRONTEND_CLIENT_ID}" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  fi
  
  echo "✅ Frontend client created"
else
  echo "ℹ️  Frontend client already exists, updating..."
  curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients/${CLIENT_ID}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"clientId\": \"${FRONTEND_CLIENT_ID}\",
      \"enabled\": true,
      \"publicClient\": true,
      \"protocol\": \"openid-connect\",
      \"standardFlowEnabled\": true,
      \"directAccessGrantsEnabled\": true,
      \"redirectUris\": [\"http://localhost:5005/*\", \"http://localhost:5173/*\"],
      \"webOrigins\": [\"http://localhost:5005\", \"http://localhost:5173\", \"+\"]
    }" > /dev/null
fi

# Set client token lifespan
if [ -n "$CLIENT_ID" ]; then
  CLIENT_CONFIG=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients/${CLIENT_ID}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")
  
  ATTRIBUTES=$(echo "$CLIENT_CONFIG" | grep -o '"attributes":{[^}]*}' | head -1)
  if [ -z "$ATTRIBUTES" ] || [ "$ATTRIBUTES" = '"attributes":{}' ]; then
    UPDATED_CONFIG=$(echo "$CLIENT_CONFIG" | sed 's/"attributes":{}/"attributes":{"access.token.lifespan":"3600"}/')
  else
    UPDATED_CONFIG=$(echo "$CLIENT_CONFIG" | sed 's/"access\.token\.lifespan":"[^"]*"/"access.token.lifespan":"3600"/')
    if ! echo "$UPDATED_CONFIG" | grep -q "access.token.lifespan"; then
      UPDATED_CONFIG=$(echo "$UPDATED_CONFIG" | sed 's/"attributes":{/"attributes":{"access.token.lifespan":"3600",/')
    fi
  fi
  
  curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients/${CLIENT_ID}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$UPDATED_CONFIG" > /dev/null
  echo "✅ Client token lifespan set to 1 hour"
fi

# Add protocol mapper to include groups in access token (org context claim)
if [ -n "$CLIENT_ID" ]; then
  echo "🧩 Ensuring 'groups' claim mapper exists on client..."
  EXISTING_MAPPERS=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients/${CLIENT_ID}/protocol-mappers/models" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")
  if echo "$EXISTING_MAPPERS" | grep -q "\"name\":\"groups\""; then
    echo "ℹ️  groups mapper already exists"
  else
    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/clients/${CLIENT_ID}/protocol-mappers/models" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"groups\",
        \"protocol\": \"openid-connect\",
        \"protocolMapper\": \"oidc-group-membership-mapper\",
        \"consentRequired\": false,
        \"config\": {
          \"full.path\": \"false\",
          \"id.token.claim\": \"true\",
          \"access.token.claim\": \"true\",
          \"userinfo.token.claim\": \"true\",
          \"claim.name\": \"groups\",
          \"jsonType.label\": \"String\"
        }
      }" > /dev/null
    echo "✅ groups mapper created"
  fi
fi

# Create users
echo "👤 Creating users..."

# System Owner user
SYSTEM_OWNER_USERNAME="system-owner"
SYSTEM_OWNER_PASSWORD="SO"
USER_CHECK=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${SYSTEM_OWNER_USERNAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

if ! echo "$USER_CHECK" | grep -q '"username"'; then
  CREATE_USER_RESPONSE=$(curl -s -i -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${SYSTEM_OWNER_USERNAME}\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"email\": \"system-owner@example.com\"
    }")
  
  USER_ID=$(echo "$CREATE_USER_RESPONSE" | grep -i "location:" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
  
  if [ -z "$USER_ID" ]; then
    USER_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${SYSTEM_OWNER_USERNAME}" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  fi
  
  if [ -n "$USER_ID" ]; then
    # Set password
    curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/reset-password" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"type\": \"password\",
        \"value\": \"${SYSTEM_OWNER_PASSWORD}\",
        \"temporary\": false
      }" > /dev/null
    
    # Assign role
    ROLE_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/system-owner" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ -n "$ROLE_ID" ]; then
      curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/role-mappings/realm" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "[{\"id\":\"${ROLE_ID}\",\"name\":\"system-owner\"}]" > /dev/null
    fi
    
    echo "✅ System Owner user created: ${SYSTEM_OWNER_USERNAME}/${SYSTEM_OWNER_PASSWORD}"
  fi
else
  echo "ℹ️  System Owner user already exists"
fi

# Organization Admin user
ORG_ADMIN_USERNAME="org-admin"
ORG_ADMIN_PASSWORD="OA"
USER_CHECK=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${ORG_ADMIN_USERNAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

if ! echo "$USER_CHECK" | grep -q '"username"'; then
  CREATE_USER_RESPONSE=$(curl -s -i -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${ORG_ADMIN_USERNAME}\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"email\": \"org-admin@example.com\"
    }")
  
  USER_ID=$(echo "$CREATE_USER_RESPONSE" | grep -i "location:" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
  
  if [ -z "$USER_ID" ]; then
    USER_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${ORG_ADMIN_USERNAME}" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  fi
  
  if [ -n "$USER_ID" ]; then
    # Set password
    curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/reset-password" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"type\": \"password\",
        \"value\": \"${ORG_ADMIN_PASSWORD}\",
        \"temporary\": false
      }" > /dev/null
    
    # Assign role
    ROLE_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/organization-admin" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ -n "$ROLE_ID" ]; then
      curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/role-mappings/realm" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "[{\"id\":\"${ROLE_ID}\",\"name\":\"organization-admin\"}]" > /dev/null
    fi
    
    echo "✅ Organization Admin user created: ${ORG_ADMIN_USERNAME}/${ORG_ADMIN_PASSWORD}"
  fi
else
  echo "ℹ️  Organization Admin user already exists"
fi

#
# Default org group setup (so org-admin can immediately use API keys)
#
DEFAULT_ORG_NAME="${DEFAULT_ORG_NAME:-volvo}"
echo "🏢 Ensuring default organization group exists: ${DEFAULT_ORG_NAME}"

# Ensure group exists (create if missing)
GROUPS_JSON=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/groups" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")
GROUP_ID=$(echo "$GROUPS_JSON" | grep -o "\"id\":\"[^\"]*\"[^}]*\"name\":\"${DEFAULT_ORG_NAME}\"" | head -1 | cut -d'"' -f4)

if [ -z "$GROUP_ID" ]; then
  curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/groups" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"${DEFAULT_ORG_NAME}\"}" > /dev/null

  GROUPS_JSON=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/groups" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")
  GROUP_ID=$(echo "$GROUPS_JSON" | grep -o "\"id\":\"[^\"]*\"[^}]*\"name\":\"${DEFAULT_ORG_NAME}\"" | head -1 | cut -d'"' -f4)
fi

# Add org-admin user to the org group (and remove other groups)
ORG_ADMIN_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${ORG_ADMIN_USERNAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$GROUP_ID" ] && [ -n "$ORG_ADMIN_ID" ]; then
  CURRENT_GROUPS=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${ORG_ADMIN_ID}/groups" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")

  # remove existing groups
  for gid in $(echo "$CURRENT_GROUPS" | grep -o '"id":"[^"]*' | cut -d'"' -f4); do
    curl -s -X DELETE "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${ORG_ADMIN_ID}/groups/${gid}" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" > /dev/null || true
  done

  # add default org group
  curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${ORG_ADMIN_ID}/groups/${GROUP_ID}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{}" > /dev/null

  echo "✅ Assigned ${ORG_ADMIN_USERNAME} to org group '${DEFAULT_ORG_NAME}'"
else
  echo "⚠️  Could not assign org-admin to default org group (missing IDs)"
fi

## System Admin user
SYS_ADMIN_USERNAME="system-admin"
SYS_ADMIN_PASSWORD="SA"
USER_CHECK=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${SYS_ADMIN_USERNAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

if ! echo "$USER_CHECK" | grep -q '"username"'; then
  CREATE_USER_RESPONSE=$(curl -s -i -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${SYS_ADMIN_USERNAME}\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"email\": \"system-admin@example.com\"
    }")

  USER_ID=$(echo "$CREATE_USER_RESPONSE" | grep -i "location:" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
  if [ -z "$USER_ID" ]; then
    USER_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${SYS_ADMIN_USERNAME}" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  fi

  if [ -n "$USER_ID" ]; then
    curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/reset-password" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{
        \"type\": \"password\",
        \"value\": \"${SYS_ADMIN_PASSWORD}\",
        \"temporary\": false
      }" > /dev/null

    ROLE_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/system-admin" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ -n "$ROLE_ID" ]; then
      curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/role-mappings/realm" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "[{\"id\":\"${ROLE_ID}\",\"name\":\"system-admin\"}]" > /dev/null
    fi

    echo "✅ System Admin user created: ${SYS_ADMIN_USERNAME}/${SYS_ADMIN_PASSWORD}"
  fi
else
  echo "ℹ️  System Admin user already exists"
fi

echo ""
echo "✅ Keycloak initialization complete!"
echo ""
echo "⏱️  Session Settings Configured:"
echo "   SSO Session Idle Timeout: 30 minutes (1800 seconds)"
echo "   SSO Session Max Lifespan: 10 hours (36000 seconds)"
echo "   Access Token Lifespan: 1 hour (3600 seconds)"
echo "   Frontend Client Token Lifespan: 1 hour (3600 seconds)"
echo ""
echo "👤 Default Users:"
echo "   System Owner: system-owner / SO"
echo "   System Admin: system-admin / SA"
echo "   Organization Admin: org-admin / OA"
echo ""
echo "🔗 Keycloak Admin Console: ${KEYCLOAK_URL}"
echo "   Username: ${KEYCLOAK_ADMIN}"
echo "   Password: ${KEYCLOAK_ADMIN_PASSWORD}"
