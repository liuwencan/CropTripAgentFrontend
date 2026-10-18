# Proposal

## Why

企业员工需要一个统一入口来咨询差旅政策、规划行程并逐步完成申请和预订，但后端能力仍在演进，前端需要先建立稳定的交互模型和接口适配边界。现在规划 Vue + TypeScript + Element Plus 的前端，可让后续 Agent 编排、供应商接入和管理能力在不重写核心交互的情况下逐步接入，并确保对话响应以 Markdown 流式内容安全、可读地呈现。

## What Changes

- 建立基于 Vue 3、TypeScript、Vite 和 Element Plus 的企业差旅助手前端应用骨架。
- 提供登录、会话恢复、登出、当前用户信息和基于角色的工作台入口；对接后端 `/auth` 及统一 `Response` 响应结构。
- 提供员工工作台和对话页面，支持消息列表、流式增量响应、Markdown 渲染、代码/表格/链接展示、加载中断、失败重试和会话历史。
- 建立差旅任务展示模型，支持从对话中呈现政策校验、行程建议、待确认动作和预订结果等结构化卡片，并为需要用户确认的动作提供明确入口。
- 提供管理员入口的基础页面规划：用户、动态配置、Prompt 及版本审计；与后端 `/system/user`、`/config`、`/system/prompt` 接口保持分层适配。
- 建立 HTTP、流式传输、认证失效、统一错误提示和环境配置的前端基础设施。
- 约束清晰的目录和依赖方向：静态资源、公用组件、公用状态、工具、API、页面、路由、配置和类型分离，禁止页面或组件直接拼接请求和跨模块访问实现细节。
- 支持构建时和部署后的配置变更，可在不修改业务代码的情况下调整后端地址、流式接口地址、应用标题、mock 开关和功能开关。
- 预留 Agent 编排和供应商接口尚未实现时的 mock/feature flag 能力，避免把未落地的后端行为硬编码到组件中。

## Capabilities

### New Capabilities

- `identity-workspace`: 企业用户登录态、角色导航和员工/管理员工作台入口。
- `streaming-travel-conversation`: 差旅助手会话、流式 Markdown 消息渲染、会话状态和错误恢复。
- `travel-workflow-presentation`: 差旅政策、行程、确认动作和预订结果的结构化前端呈现。
- `admin-configuration-console`: 用户、动态配置、Prompt 版本和发布审计的管理端页面适配。

### Modified Capabilities

- 无。当前项目尚无已发布的前端能力规格。

## Impact

- 新增 Vue 3 + TypeScript + Vite 应用代码、Element Plus UI、Markdown 解析/渲染及安全处理依赖。
- 新增明确分层的 API client、认证状态、会话状态、流式传输适配器、路由、配置和错误处理模块。
- 依赖后端现有 `/auth`、`/system/user`、`/config`、`/system/prompt` 契约；智能对话和差旅业务接口需要与后端后续协商事件格式。
- 部署配置通过环境变量或静态运行时配置文件注入，避免把环境地址、端口和开关硬编码到源码。
- 不修改后端代码，不在本变更中实现 Agent 编排、供应商调用、支付或真实预订。
