#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${GREEN}$1${NC}"
}

print_warn() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

# Check if parameters are provided
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <organization_name> <username> [password]"
    print_error "Example: $0 volvo org-admin-volvo OA"
    exit 1
fi

ORG_NAME="$1"
USERNAME="$2"
PASSWORD="${3:-OA}"  # Default password is OA if not provided

# Configuration
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
KEYCLOAK_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KEYCLOAK_ADMIN_PASSWORD="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM_NAME="${REALM_NAME:-bestai}"
AUTH_SERVICE_URL="${AUTH_SERVICE_URL:-http://localhost:5007}"

print_info "🔐 Adding Organization Admin: ${USERNAME} for organization: ${ORG_NAME}"
print_info ""

# Step 1: Get Keycloak admin token
print_info "🔑 Getting Keycloak admin token..."
ADMIN_TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=${KEYCLOAK_ADMIN}" \
  -d "password=${KEYCLOAK_ADMIN_PASSWORD}")

ADMIN_TOKEN=$(echo "$ADMIN_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  print_error "❌ Failed to get admin token. Is Keycloak running?"
  exit 1
fi

print_info "✅ Admin token obtained"

# Step 2: Check if user exists in Keycloak
print_info "👤 Checking if user '${USERNAME}' exists in Keycloak..."
USER_CHECK=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${USERNAME}" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}")

USER_EXISTS=false
USER_ID=""

if echo "$USER_CHECK" | grep -q '"username"'; then
  USER_EXISTS=true
  USER_ID=$(echo "$USER_CHECK" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  print_info "✅ User '${USERNAME}' already exists in Keycloak"
else
  print_info "ℹ️  User '${USERNAME}' does not exist, will create new user"
fi

# Step 3: Create or update user in Keycloak
if [ "$USER_EXISTS" = true ]; then
  # Update existing user (rename if needed)
  print_info "🔄 Updating user '${USERNAME}' in Keycloak..."
  curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${USERNAME}\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"email\": \"${USERNAME}@example.com\"
    }" > /dev/null
  
  # Update password
  curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/reset-password" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"password\",
      \"value\": \"${PASSWORD}\",
      \"temporary\": false
    }" > /dev/null
  
  print_info "✅ User updated in Keycloak"
else
  # Create new user
  print_info "➕ Creating user '${USERNAME}' in Keycloak..."
  CREATE_USER_RESPONSE=$(curl -s -i -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${USERNAME}\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"email\": \"${USERNAME}@example.com\"
    }")
  
  USER_ID=$(echo "$CREATE_USER_RESPONSE" | grep -i "location:" | grep -oE '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
  
  if [ -z "$USER_ID" ]; then
    USER_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${USERNAME}" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  fi
  
  if [ -z "$USER_ID" ]; then
    print_error "❌ Failed to create user in Keycloak"
    exit 1
  fi
  
  # Set password
  curl -s -X PUT "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/reset-password" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"type\": \"password\",
      \"value\": \"${PASSWORD}\",
      \"temporary\": false
    }" > /dev/null
  
  print_info "✅ User created in Keycloak"
fi

# Step 4: Assign organization-admin role to user
print_info "👥 Assigning 'organization-admin' role to user..."
ROLE_ID=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/organization-admin" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$ROLE_ID" ]; then
  # Check if user already has the role
  USER_ROLES=$(curl -s -X GET "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/role-mappings/realm" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}")
  
  if ! echo "$USER_ROLES" | grep -q "organization-admin"; then
    curl -s -X POST "${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users/${USER_ID}/role-mappings/realm" \
      -H "Authorization: Bearer ${ADMIN_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "[{\"id\":\"${ROLE_ID}\",\"name\":\"organization-admin\"}]" > /dev/null
    print_info "✅ Role assigned in Keycloak"
  else
    print_info "ℹ️  User already has organization-admin role"
  fi
else
  print_warn "⚠️  Could not find organization-admin role in Keycloak"
fi

# Step 5: Get System Owner token for backend API
print_info "🔑 Getting System Owner token for backend API..."
SO_TOKEN_RESPONSE=$(curl -s -X POST "${KEYCLOAK_URL}/realms/${REALM_NAME}/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "client_id=platform-frontend" \
  -d "username=system-owner" \
  -d "password=SO")

SO_TOKEN=$(echo "$SO_TOKEN_RESPONSE" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$SO_TOKEN" ]; then
  print_error "❌ Failed to get System Owner token. Make sure system-owner user exists."
  exit 1
fi

# Step 6: Create organization in backend database
print_info "🏢 Creating organization '${ORG_NAME}' in backend..."
ORG_RESPONSE=$(curl -s -X POST "${AUTH_SERVICE_URL}/api/organizations" \
  -H "Authorization: Bearer ${SO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"${ORG_NAME}\",
    \"description\": \"Organization created via add_organization_admin script\"
  }")

# Check if organization was created or already exists
if echo "$ORG_RESPONSE" | grep -q '"id"'; then
  ORG_ID=$(echo "$ORG_RESPONSE" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  print_info "✅ Organization created with ID: ${ORG_ID}"
elif echo "$ORG_RESPONSE" | grep -q "already exists"; then
  print_warn "⚠️  Organization '${ORG_NAME}' already exists, fetching ID..."
  # Get existing organization
  ORGS_RESPONSE=$(curl -s -X GET "${AUTH_SERVICE_URL}/api/organizations" \
    -H "Authorization: Bearer ${SO_TOKEN}")
  ORG_ID=$(echo "$ORGS_RESPONSE" | grep -o "\"id\":[0-9]*,\"name\":\"${ORG_NAME}\"" | grep -o '"id":[0-9]*' | cut -d':' -f2)
  if [ -z "$ORG_ID" ]; then
    # Try alternative parsing
    ORG_ID=$(echo "$ORGS_RESPONSE" | grep -A 5 "\"name\":\"${ORG_NAME}\"" | grep -o '"id":[0-9]*' | head -1 | cut -d':' -f2)
  fi
  print_info "✅ Found existing organization with ID: ${ORG_ID}"
else
  print_error "❌ Failed to create organization: ${ORG_RESPONSE}"
  exit 1
fi

if [ -z "$ORG_ID" ]; then
  print_error "❌ Could not determine organization ID"
  exit 1
fi

# Step 7: Assign user to organization in backend
print_info "🔗 Assigning user '${USERNAME}' to organization '${ORG_NAME}'..."
ASSIGN_RESPONSE=$(curl -s -X POST "${AUTH_SERVICE_URL}/api/organizations/${ORG_ID}/assign-user" \
  -H "Authorization: Bearer ${SO_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"${USERNAME}\",
    \"role\": \"OA\"
  }")

if echo "$ASSIGN_RESPONSE" | grep -q "successfully\|assigned"; then
  print_info "✅ User assigned to organization"
else
  if echo "$ASSIGN_RESPONSE" | grep -q "already exists\|ON CONFLICT"; then
    print_warn "⚠️  User is already assigned to this organization"
  else
    print_error "❌ Failed to assign user: ${ASSIGN_RESPONSE}"
    exit 1
  fi
fi

print_info ""
print_info "✅ Successfully configured Organization Admin!"
print_info ""
print_info "📋 Summary:"
print_info "   Organization: ${ORG_NAME} (ID: ${ORG_ID})"
print_info "   Username: ${USERNAME}"
print_info "   Password: ${PASSWORD}"
print_info "   Role: Organization Admin (OA)"
print_info ""
print_info "🔗 Access:"
print_info "   Frontend: http://localhost:5005"
print_info "   Keycloak: http://localhost:8080"
print_info ""
