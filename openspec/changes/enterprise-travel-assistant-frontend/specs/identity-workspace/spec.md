# Spec Delta

## Purpose

为企业员工和管理员提供一致的登录、会话恢复与角色工作台入口，使前端在后端认证和权限状态变化时保持可预测、可恢复的行为。

## ADDED Requirements

### Requirement: User can authenticate and restore a session
The system SHALL provide login and logout flows that consume the backend authentication contract and SHALL restore the current user after a page reload when the session remains valid.

#### Scenario: Successful login
- **WHEN** a user submits valid credentials
- **THEN** the system stores the returned authentication state, loads the current user profile, and navigates to the permitted workspace

#### Scenario: Invalid credentials
- **WHEN** the backend rejects the credentials
- **THEN** the system keeps the user on the login view and presents the backend error without exposing sensitive details

#### Scenario: Session restoration fails
- **WHEN** the application starts with no valid session or the current-user request returns an authentication error
- **THEN** the system clears stale authentication state and presents the login view

### Requirement: Navigation reflects user roles
The system SHALL expose employee workspace routes to authenticated users and SHALL expose administrator routes only when the current user has the backend administrator role.

#### Scenario: Employee opens an administrator route
- **WHEN** an authenticated non-administrator navigates to an administrator route
- **THEN** the system denies access and redirects to the employee workspace with a permission message

#### Scenario: Administrator opens an administrator route
- **WHEN** an authenticated administrator navigates to an administrator route
- **THEN** the system renders the requested administrator view and its authorized data loading state

### Requirement: Authentication errors are handled consistently
The system SHALL handle expired or invalid authentication for API requests by clearing the local session and directing the user to re-authenticate.

#### Scenario: Authenticated request expires
- **WHEN** a protected request returns the backend unauthenticated status
- **THEN** the system stops dependent loading, clears authentication state, and redirects to login while preserving a safe return location

### Requirement: User can sign out
The system SHALL provide a sign-out action that calls the backend logout contract when available and always removes local session state before returning to login.

#### Scenario: User signs out
- **WHEN** the user confirms sign-out
- **THEN** the system ends the local session, attempts backend logout, and navigates to login regardless of backend logout response

### Requirement: Deployment configuration controls backend connectivity
The system SHALL obtain the HTTP API address, application title, and optional feature flags from validated deployment configuration rather than hardcoded page or API module constants.

#### Scenario: Deployment changes the backend address
- **WHEN** an operator replaces the supported runtime configuration file with a valid API address and reloads the deployed application
- **THEN** subsequent API requests use the new address without rebuilding or changing application source code

#### Scenario: Deployment configuration is invalid
- **WHEN** the runtime configuration is missing, malformed, or contains an unsupported backend address
- **THEN** the system shows a startup configuration error and does not issue protected business requests
