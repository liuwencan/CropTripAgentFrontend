# Design

## Context

前端目录目前只有 OpenSpec 配置，没有现成应用代码或组件约定。后端是 Spring Boot 单体，使用 Sa-Token 会话、统一 `Response`/`PageResponse` 响应和 `/auth`、`/system/user`、`/config`、`/system/prompt` 管理接口；差旅 Agent 编排和供应商能力仍未实现。详见 `proposal.md` 和后端 `E:\code\agent\CorpTripAgent\doc\architecture-overview.md`。

## Goals / Non-Goals

**Goals:**

- 建立可逐步扩展的 Vue 3 前端边界：路由、认证、请求、状态、页面和领域组件相互隔离。
- 以一个可版本化的流事件协议承载 Markdown 增量、结构化差旅数据、确认动作和错误。
- 让 Markdown 从增量文本到最终内容都安全可渲染，并保持滚动、重试、取消等交互稳定。
- 对现有后端管理接口使用类型化 API 适配器；对尚未实现的差旅接口保留 mock 和 feature flag。
- 覆盖桌面办公场景，并在窄屏下保持消息、表格和确认操作可用。

**Non-Goals:**

- 本变更不实现后端 Agent、供应商、政策引擎、预订、支付或报销服务。
- 本变更不改变后端认证、响应包装或数据库模型。
- 本变更不把 Prompt 正文、供应商密钥或后端业务规则复制到浏览器。

## Decisions

### 1. 应用分层与技术基线

使用 Vue 3 Composition API、TypeScript、Vite、Vue Router、Pinia 和 Element Plus。目录保持浅层、按职责拆分：

```text
src/
├─ assets/       # 图片、字体、主题等静态资源
├─ components/   # 无页面归属的公用组件
├─ layouts/      # 页面布局和壳组件
├─ views/        # 路由页面，只编排业务流程
├─ router/       # 路由定义和权限守卫
├─ store/        # 跨页面共享状态
├─ api/          # 按领域拆分的 authApi、conversationApi、travelApi、userApi、configApi、promptApi
├─ utils/        # HTTP、SSE、Markdown、安全、格式化等无业务状态工具
├─ config/       # 构建时和运行时配置读取
└─ types/        # API DTO、领域模型和公共类型
```

依赖方向固定为 `views -> store/api/components`、`store -> api/types`、`api -> utils/config/types`、`components -> utils/types`；`assets` 只被组件、布局和样式引用。`api` 不依赖页面或组件，组件不直接发请求，页面不直接拼接 URL，领域模块不互相引用内部实现。目录只在出现真实复用或独立边界时增加文件，不引入额外的 service/repository/container 层。

TypeScript 类型从后端契约和流事件模型单独维护，避免组件直接依赖响应 DTO。

替代方案：把请求和状态写在页面组件中实现最快，但会让流式取消、认证失效和管理员接口重复；集中式领域层更适合后端持续演进。

### 2. 认证和 API 客户端

创建统一 HTTP 客户端处理 base URL、JSON、认证凭据、`Response`/`PageResponse` 解包和错误映射；各领域 `*Api` 只描述接口路径、参数和返回类型，不重复实现请求逻辑。认证 store 保存最小必要会话信息，启动时调用当前用户接口恢复；请求拦截器遇到未认证状态只执行一次清理和跳转，避免多个并发请求产生重复导航。管理员路由同时由路由守卫和页面操作权限控制，后端拒绝仍作为最终事实。

替代方案：只在路由进入时检查角色无法覆盖异步操作中的权限撤销，因此采用路由级和请求级双层处理。

### 3. 流式事件与 Markdown 渲染

定义版本化事件信封，例如 `{ version, conversationId, messageId, type, sequence, payload }`，`type` 至少包括 `message.delta`、`message.done`、`workflow.update`、`action.confirmation_required`、`error` 和 `done`。首期固定使用 SSE，通过 `fetch` + `ReadableStream` adapter 解析事件；传输细节由 adapter 隔离，store 只接收规范化事件。每个 assistant message 维护 `status`、`rawMarkdown`、`sequence` 和结构化 blocks，按 sequence 丢弃重复或过期事件。

Markdown 管线采用成熟解析器和 sanitizer：解析结果只能进入受控渲染容器，允许安全链接、表格、代码块，禁止脚本、事件属性和危险 URL。增量期间对不完整 fenced code/table 保持原文可读，完成后再刷新高亮；消息 ID 和 AbortController 用于精确取消与重试。

替代方案：直接使用 `v-html` 或手写 Markdown 正则无法满足安全和复杂语法要求；WebSocket 作为首选会增加后端连接协议约束，因此先以 HTTP 流适配器为默认实现。

### 4. 差旅工作流模型

将政策检查、行程选项、住宿/交通资源、确认动作和预订结果定义为联合类型，均带 `workflowId`、`status` 和可选 `source`。Conversation store 负责消息顺序，并保留历史会话 API 的适配边界；后端历史接口未就绪时由 mock 实现供页面验证。workflow store 负责可跨消息更新的工作流；确认 action 使用客户端生成的幂等键，由后端回显/校验，并在 pending 时禁用重复提交。供应商部分失败保留成功结果，并把重试范围限制到失败 source。

替代方案：把所有结构化内容序列化为 Markdown 可减少类型，但会失去确认、状态更新和无障碍操作能力，因此保留文本与结构化 block 并行。

### 5. 配置化与部署变更

配置分为构建时配置和运行时配置两层。开发和 CI 使用 `VITE_API_BASE_URL`、`VITE_STREAM_BASE_URL`、`VITE_APP_TITLE`、`VITE_ENABLE_MOCK` 和按模块命名的 feature flag；生产部署优先读取 `public/runtime-config.js` 暴露的只读配置对象，未提供时回退到构建时环境变量。配置读取集中在 `src/config`，业务模块只消费已校验的配置对象，不直接访问 `import.meta.env` 或 `window`。

运行时配置文件不包含密钥，只包含后端 HTTP 地址、流式地址、应用标题和布尔开关。部署人员可以替换该文件后重新加载静态资源即可切换后端地址或端口；配置缺失、格式错误或地址不是允许的 HTTP(S) 地址时，应用显示启动配置错误并停止发起业务请求。

替代方案：把地址写死在 API 文件中最简单但无法支持同一构建产物多环境部署；引入远程配置中心会增加运行时依赖和复杂度，因此采用静态运行时配置文件。

### 6. 管理端适配与渐进交付

按后端现有路径实现 `authApi`、`userApi`、`configApi`、`promptApi`，统一处理分页、表单校验和业务错误。管理页面先覆盖查询、编辑、发布/下线/回滚与审计展示；高风险操作使用 Element Plus 确认弹窗并要求后端规定的原因字段。差旅接口未就绪时由环境变量选择 mock stream，mock 事件必须使用同一规范化 adapter，确保切换后不改页面代码。

### 7. 可观测性、测试和可访问性

开发环境记录 request ID、conversation ID、message ID 和 stream sequence，生产环境只记录去敏后的错误上下文。测试分为纯函数（事件归并、Markdown sanitizer、权限判断）、组件交互（取消/重试/确认）和端到端主流程（登录、发送消息、管理员发布）。消息区域使用语义角色、键盘可达控件和明确的加载/错误文本；长表格和代码块支持横向滚动。

## Risks / Trade-offs

- [后端流协议尚未确定] -> 首期固定 SSE，冻结版本化事件信封和 adapter 接口，并把具体地址放进配置。
- [流式 Markdown 在中间状态可能出现未闭合语法] -> 保留原始文本作为回退，增量渲染失败时显示纯文本并在完成事件后重算。
- [浏览器会话与后端 JVM 内存会话在多实例部署下不一致] -> 前端集中处理未认证重定向；后端切换共享会话存储时保持 API 形状不变。
- [管理员操作不可逆或影响线上 Prompt] -> publish/unpublish/rollback 均要求确认、原因（若契约要求）和结果刷新，操作前展示目标版本摘要。
- [Element Plus 和 Markdown 依赖增加包体] -> 只按路由懒加载管理页和重型渲染插件，生产构建检查体积。
- [运行时配置被错误缓存] -> 为配置文件使用独立缓存策略或版本查询参数，并在启动页显示当前非敏感环境标识。

## Migration Plan

1. 初始化 Vite/Vue/TypeScript 项目和质量门禁，创建约定目录、依赖检查和配置读取模块，先接入登录与基础布局。
2. 接入现有 `/auth`、统一响应解包和管理员 API，使用契约样例验证错误映射；所有接口通过 `src/api` 领域模块访问。
3. 实现规范化 stream adapter、Markdown sanitizer 和 conversation store，先以 mock stream 验证取消、重试和乱序事件。
4. 加入差旅 workflow blocks 与确认幂等控制；后端接口稳定后切换环境开关到真实 stream。
5. 分批上线管理员页面，按模块开启路由；通过 `runtime-config.js` 调整后端地址、端口和 feature flag，发现问题时关闭开关或回滚前端静态资源版本，不需要数据库迁移。

## Open Questions

- 后端最终的鉴权头/会话凭据策略、事件字段命名和确认动作的超时/撤销语义，需要在实现前通过接口契约确认；这些细节不改变本设计的 adapter、状态机和幂等键边界。
