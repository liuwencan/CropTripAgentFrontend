# Spec Delta

## Purpose

让员工通过自然语言完成差旅咨询和任务推进，并以增量 Markdown 消息及时看到助手思考结果、结构化信息、确认请求和可恢复的错误状态。

## ADDED Requirements

### Requirement: User can manage travel assistant conversations
The system SHALL allow an authenticated user to start a conversation, view available conversation history, select a conversation, and send a new text message.

#### Scenario: Start a conversation
- **WHEN** the user opens the assistant workspace without an existing conversation
- **THEN** the system creates or selects a conversation context and presents an empty composer ready for input

#### Scenario: Send a message
- **WHEN** the user submits non-empty text
- **THEN** the system appends the user message immediately, creates an assistant response placeholder, and starts the configured streaming request

#### Scenario: Load conversation history
- **WHEN** the user selects a previous conversation
- **THEN** the system loads messages in chronological order and preserves the selected conversation while new data is loading

### Requirement: Assistant responses render incremental Markdown safely
The system SHALL render each streamed assistant response as Markdown incrementally, including headings, lists, links, tables, inline code, code blocks, and line breaks, while sanitizing unsafe HTML and URL schemes.

#### Scenario: Receive text chunks
- **WHEN** the stream emits multiple text chunks for one assistant message
- **THEN** the same message updates in place without duplicating already rendered content or reordering prior messages

#### Scenario: Receive Markdown table and code
- **WHEN** the completed content contains a Markdown table or fenced code block
- **THEN** the rendered message displays the table and code with readable formatting and preserves copyable code text

#### Scenario: Receive unsafe markup
- **WHEN** streamed content contains raw script markup or an unsafe link scheme
- **THEN** the system removes or neutralizes the unsafe content before inserting it into the document

### Requirement: User can control an active stream
The system SHALL expose active, completed, failed, cancelled, and retryable states for an assistant response and SHALL allow the user to stop an active stream.

#### Scenario: Stop generation
- **WHEN** the user stops an active response
- **THEN** the system cancels the underlying request, keeps received content as a partial message, and marks the response as cancelled

#### Scenario: Stream fails
- **WHEN** the stream terminates with a transport or server error
- **THEN** the system keeps received content, marks the message as failed, and provides a retry action without resending the user message automatically

#### Scenario: Retry a failed response
- **WHEN** the user retries a failed response
- **THEN** the system starts a new request for the same user message and updates the existing assistant response state

### Requirement: Stream events preserve structured assistant actions
The system SHALL accept a versioned stream event envelope that can carry Markdown text, status updates, structured travel data, confirmation requests, and terminal errors without requiring the message renderer to know transport details.

#### Scenario: Receive a confirmation request
- **WHEN** the stream includes an action requiring user confirmation
- **THEN** the system renders the action with its summary, risk or policy information when supplied, and explicit confirm and cancel controls

#### Scenario: Receive an unsupported event
- **WHEN** the stream includes an unknown event type or malformed payload
- **THEN** the system records a non-blocking diagnostic state and continues rendering known content or presents a recoverable error

### Requirement: Streaming requests use configured connectivity
The system SHALL send assistant streaming requests through the configured stream endpoint and SHALL keep transport parsing separate from conversation state and message rendering.

#### Scenario: Stream endpoint is configured at deployment
- **WHEN** the deployed runtime configuration supplies a valid stream endpoint
- **THEN** a new assistant request opens the SSE stream at that endpoint without a code change

#### Scenario: Stream endpoint is unavailable
- **WHEN** the configured endpoint cannot be reached
- **THEN** the system marks the assistant response as failed, preserves received content, and offers retry or mock mode when enabled
