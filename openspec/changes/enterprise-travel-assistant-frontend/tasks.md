# Tasks

## 1. Project Foundation

- [x] 1.1 Initialize the Vue 3 + TypeScript + Vite application and configure Element Plus, Vue Router, Pinia, ESLint, formatting, and environment files; verify `npm install` and the production build complete successfully.
- [x] 1.2 Create the `src/assets`, `components`, `layouts`, `views`, `router`, `store`, `api`, `utils`, `config`, and `types` boundaries with only the minimum files needed; verify the expected tree exists and no page or component imports another module's implementation file.
- [x] 1.3 Add a lightweight dependency-boundary check or documented lint rule for `views -> store/api/components`, `store -> api/types`, `api -> utils/config/types`, and `components -> utils/types`; verify forbidden imports fail the check without requiring a custom container or deep abstraction.
- [x] 1.4 Add route-level loading, not-found, and global error views with the shared notification policy; verify an unknown route and a rejected lazy import produce recoverable UI states.
- [x] 1.5 Add build-time environment parsing and `public/runtime-config.js` loading with validation and fallback rules; verify the application can change API address, stream address, title, mock mode, and feature flags by replacing the runtime config file without rebuilding.

## 2. Authentication And Workspace

- [x] 2.1 Define typed backend response envelopes, API errors, user roles, and authentication state; verify unit tests cover success, validation, unauthenticated, and forbidden mappings from the documented `/auth` contract.
- [x] 2.2 Implement the shared HTTP utility and `authApi`/auth store for login, current-user restoration, logout, stale-session cleanup, and one-time unauthenticated redirect; verify store tests cover reload restoration, concurrent expiry, and logout when the backend is unavailable.
- [x] 2.3 Implement employee and administrator route guards and workspace layouts; verify an employee cannot open admin routes while an administrator can, and permission changes received during an API call are reflected in the UI.
- [x] 2.4 Build the login, employee workspace, and account menu views using Element Plus; verify component tests cover invalid credentials, loading states, sign-out, keyboard navigation, and redirect-back behavior.

## 3. Conversation And SSE Streaming

- [x] 3.1 Define the versioned SSE event envelope and normalized event union for Markdown deltas, completion, workflow updates, confirmation requests, errors, and terminal events; verify parser tests cover comments, multi-line data, malformed events, duplicate sequence numbers, and reconnect termination.
- [x] 3.2 Implement the SSE utility and `conversationApi` stream adapter with `AbortController`, timeout/error mapping, request correlation IDs, and mock stream mode for environments without the backend; verify adapter tests cover cancellation, transport failure, terminal error, and deterministic mock replay.
- [x] 3.3 Implement conversation history/current-session APIs and the conversation store, including optimistic user messages, assistant placeholders, ordered delta aggregation, cancellation, failure, and retry; verify store tests cover history loading, concurrent sends, stale events, and retry without duplicating the user message.
- [x] 3.4 Add the Markdown parser and sanitizer pipeline for safe links, tables, code blocks, and incomplete streaming syntax; verify security tests reject scripts, event attributes, and unsafe URL schemes while preserving expected Markdown output.
- [x] 3.5 Build the conversation view, message list, composer, stream controls, retry states, and accessible auto-scroll behavior; verify component tests cover send, stop, partial output, retry, empty state, narrow viewport layout, and copyable code blocks.

## 4. Travel Workflow Presentation

- [x] 4.1 Define typed workflow blocks for policy checks, itinerary options, supplier results, confirmation actions, and booking outcomes; verify model tests cover partial success, missing optional fields, terminal statuses, and unknown block types.
- [x] 4.2 Implement the workflow store and `travelApi` action client with client-generated idempotency keys, pending locks, scoped retries, and refresh-after-reconnect; verify tests prove duplicate confirmations issue one request and failed suppliers can be retried independently.
- [x] 4.3 Build policy, itinerary, confirmation, and booking result components with explicit loading/success/partial/failure/cancelled states; verify component tests cover compliant and non-compliant policies, comparable options, confirmation cancel/confirm, and partial supplier results.
- [x] 4.4 Integrate workflow blocks into conversation messages and document the event-to-block contract with representative SSE fixtures; verify an end-to-end test renders a streamed policy result and completes one confirmation flow.

## 5. Administrator Console

- [x] 5.1 Implement typed `userApi`, `configApi`, and `promptApi` adapters for `/system/user`, `/config`, and `/system/prompt`, including pagination and business-error mapping; verify contract tests cover the documented response wrappers and forbidden responses.
- [x] 5.2 Build paginated user management and password reset views with validation, confirmation, and result feedback; verify component tests cover empty/data/error states, reset reason validation, duplicate-submit prevention, and revoked permissions.
- [x] 5.3 Build dynamic configuration list/edit/create/delete/reload views; verify component tests cover required fields, successful refresh, reload errors, and delete confirmation.
- [x] 5.4 Build Prompt definitions, version comparison, publish/unpublish/rollback confirmation, and release audit views; verify tests cover operation reasons, status refresh, audit rendering, and forbidden actions.
- [x] 5.5 Add lazy-loaded admin navigation and feature flags for management modules; verify disabled modules are unreachable from navigation and direct URL access shows a controlled unavailable state.

## 6. Integration Quality And Delivery

- [x] 6.1 Add MSW or equivalent API fixtures for auth, history, SSE, workflow actions, and admin endpoints; verify local development can run the complete employee and admin flows without a backend.
- [x] 6.2 Add end-to-end coverage for login, session restoration, streamed Markdown response, stop/retry, confirmation idempotency, and administrator Prompt publish; verify the suite passes against mock fixtures in CI.
- [x] 6.3 Add accessibility and responsive checks for keyboard focus, semantic message regions, tables/code overflow, and narrow layouts; verify automated checks and manual viewport smoke tests pass.
- [x] 6.4 Add production build, bundle-size, environment, and sanitized logging checks; verify the deployment artifact contains no secrets or raw sensitive credentials and the documented build command is reproducible.
- [x] 6.5 Document the deployment configuration file, supported keys, cache strategy, and rollback procedure; verify a deployed static bundle switches backend address and port by replacing only `runtime-config.js`.

## Workflow follow-up

- After implementation and review, run the OpenSpec apply/archive workflow and validate the archived capabilities against the implemented behavior.
