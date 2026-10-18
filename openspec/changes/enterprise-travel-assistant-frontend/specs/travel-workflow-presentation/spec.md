# Spec Delta

## Purpose

将差旅助手返回的政策校验、行程建议、待确认动作和预订结果转化为可扫描、可操作的界面状态，让用户清楚知道当前进度、限制和下一步动作。

## ADDED Requirements

### Requirement: Travel results expose structured status
The system SHALL render policy checks, itinerary options, booking states, and failures as structured content associated with the originating conversation message.

#### Scenario: Policy check passes
- **WHEN** the assistant returns a successful policy check
- **THEN** the system shows the checked item, applicable policy summary, and a clearly visible passed state

#### Scenario: Policy check fails
- **WHEN** the assistant returns a policy violation
- **THEN** the system shows the violated rule, relevant limits or explanation, and any available alternative without presenting the option as compliant

#### Scenario: Booking is in progress
- **WHEN** a booking action is pending or processing
- **THEN** the system shows a non-terminal progress state and prevents duplicate submission for that action

### Requirement: User can review itinerary options
The system SHALL present each itinerary option with enough information to compare it, including route, local departure and arrival times, duration, transport or lodging details, price when supplied, policy status, and source status.

#### Scenario: Multiple options are returned
- **WHEN** the assistant returns more than one itinerary option
- **THEN** the system renders comparable option blocks and identifies the recommended option when the backend marks one

#### Scenario: Option data is incomplete
- **WHEN** an option omits a non-required field
- **THEN** the system displays an explicit unavailable value and keeps the rest of the option usable

### Requirement: Confirmation actions are explicit and idempotent
The system SHALL require an explicit user action for any operation identified as requiring confirmation and SHALL prevent duplicate submits while showing the action result.

#### Scenario: User confirms an action
- **WHEN** the user confirms a pending action
- **THEN** the system submits the action once, disables repeat controls while pending, and renders the returned result in the same workflow context

#### Scenario: User cancels an action
- **WHEN** the user cancels a pending action
- **THEN** the system records the action as cancelled and does not invoke the booking or other side-effecting operation

### Requirement: Workflow state is recoverable
The system SHALL distinguish loading, success, partial success, failure, and cancelled states and SHALL provide a retry or refresh path when the backend indicates that recovery is possible.

#### Scenario: Partial supplier result
- **WHEN** one supplier result succeeds and another fails
- **THEN** the system keeps successful results visible, labels the failed source, and offers a scoped retry when supported

#### Scenario: Refresh after reconnect
- **WHEN** the user returns to a workflow after a network interruption
- **THEN** the system can reload the latest conversation and workflow state without creating duplicate actions
