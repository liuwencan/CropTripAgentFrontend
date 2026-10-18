# Spec Delta

## Purpose

为具备管理员角色的用户提供与后端管理接口对应的用户、动态配置和 Prompt 生命周期界面，同时把发布、下线、回滚和审计结果清楚地呈现出来。

## ADDED Requirements

### Requirement: Administrator can manage users within authorization
The system SHALL allow an authorized administrator to view paginated users and initiate password reset operations using the backend user-management contract.

#### Scenario: Load a user page
- **WHEN** an administrator opens the user management view
- **THEN** the system requests a page using the backend pagination shape and renders loading, empty, data, and error states

#### Scenario: Reset a user password
- **WHEN** an administrator submits a reset reason and confirms the reset
- **THEN** the system sends one reset request and displays the result or validation error without exposing the generated credential unnecessarily

### Requirement: Administrator can manage dynamic configuration
The system SHALL allow an authorized administrator to list, create, update, delete, and reload dynamic configuration entries through the backend configuration contract.

#### Scenario: Edit configuration
- **WHEN** an administrator submits a valid configuration key and value
- **THEN** the system validates required fields, sends the change, and refreshes the displayed entry after success

#### Scenario: Reload configuration
- **WHEN** an administrator requests a configuration reload
- **THEN** the system shows the reload result and identifies any failure returned by the backend

### Requirement: Administrator can manage Prompt versions and audit history
The system SHALL present Prompt definitions, versions, lifecycle status, comparison information, and release audit records, and SHALL require confirmation for publish, unpublish, and rollback actions.

#### Scenario: Publish a Prompt version
- **WHEN** an administrator confirms publishing a valid Prompt version with an operation reason when required
- **THEN** the system submits the publish request, refreshes the version status, and displays the resulting audit information

#### Scenario: Roll back a Prompt version
- **WHEN** an administrator confirms a rollback
- **THEN** the system submits the rollback request and shows both the resulting active version and the operation outcome

### Requirement: Admin failures respect backend authorization
The system SHALL treat unauthorized, forbidden, validation, and business errors from management APIs as distinct user-visible states.

#### Scenario: Permission is revoked
- **WHEN** a management request returns forbidden
- **THEN** the system hides or disables the unavailable operation and informs the administrator that the current role cannot perform it

### Requirement: Management APIs remain separated from page components
The system SHALL access user, configuration, and Prompt management endpoints through their respective typed API modules, so page components do not construct endpoint URLs or implement transport parsing.

#### Scenario: Administrator loads a management page
- **WHEN** a management view requests data
- **THEN** the request uses the corresponding domain API module and the view receives typed data or a normalized error

#### Scenario: Backend address changes after deployment
- **WHEN** the operator updates the validated deployment API address
- **THEN** all management API modules use the new address without editing individual views or API files
