# 企业差旅助手前端

企业差旅助手的前端应用，面向企业员工和管理员提供差旅咨询、政策查询、行程规划及运营管理能力。

项目使用 Vue 3 和 TypeScript 构建，支持基于 SSE 的流式对话，并将差旅流程、确认操作和管理员配置集中在一个工作台中。

## 功能

- 企业账号登录、会话恢复和权限路由
- 差旅咨询工作台和历史会话
- 基于 SSE 的流式 Agent 对话
- Markdown 消息渲染和消息重试、中止
- 差旅政策与行程流程状态展示
- 管理员用户查询、密码重置
- 系统配置查询、编辑和重新加载
- Prompt 版本查询、发布、下线、回滚和审计记录
- Mock 模式，便于本地开发和前端演示
- 响应式布局，支持桌面端和移动端

## 技术栈

- [Vue 3](https://vuejs.org/)
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- [Pinia](https://pinia.vuejs.org/)
- [Vue Router](https://router.vuejs.org/)
- [Element Plus](https://element-plus.org/)
- [Vitest](https://vitest.dev/)

## 环境要求

- Node.js 20.19+ 或 Node.js 22+
- npm 10+
- 可访问的企业差旅后端服务（使用真实 API 时）

## 快速开始

安装依赖：

```bash
npm install
```

复制本地环境配置：

```bash
cp .env.example .env
```

Windows PowerShell 可以使用：

```powershell
Copy-Item .env.example .env
```

启动开发服务器：

```bash
npm run dev
```

默认访问地址为 `http://localhost:5173`。

## 环境配置

`.env` 只用于本地开发，不应提交到 Git。项目已经通过 `.gitignore` 忽略本地环境文件；公开仓库中只保留 `.env.example`。

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 普通 JSON API 的基础地址 | `http://localhost:8080` |
| `VITE_STREAM_BASE_URL` | SSE 对话接口的基础地址 | `http://localhost:8080` |
| `VITE_APP_TITLE` | 浏览器页面标题 | `企业差旅助手` |
| `VITE_ENABLE_MOCK` | 是否启用本地 Mock 数据 | `true` 或 `false` |

### Mock 模式

将 `VITE_ENABLE_MOCK` 设置为 `true` 后，登录和对话会使用前端内置示例数据，不需要连接后端服务：

```dotenv
VITE_ENABLE_MOCK=true
```

Mock 模式适合 UI 开发、自动化测试和功能演示，不代表真实后端接口行为。

## 生产部署

构建静态资源：

```bash
npm run build
```

构建结果位于 `dist/` 目录，可以部署到 Nginx、对象存储或其他静态文件服务器。

生产环境优先通过 `public/runtime-config.js` 注入运行时配置。部署时可以替换该文件，而不必重新构建前端：

```js
window.__APP_CONFIG__ = {
  apiBaseUrl: 'https://api.example.com',
  streamBaseUrl: 'https://api.example.com',
  appTitle: '企业差旅助手',
  enableMock: false,
  features: {
    admin: true,
    travelWorkflow: true,
  },
}
```

`runtime-config.js` 会被浏览器直接读取，因此只能放公开的运行时地址和功能开关，不能放 API 密钥、数据库密码或其他敏感信息。

更多部署说明请参阅 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 类型检查并构建生产资源 |
| `npm run preview` | 预览生产构建 |
| `npm test` | 运行 Vitest 测试 |
| `npm run test:watch` | 以监听模式运行测试 |
| `npm run check:boundaries` | 检查模块边界 |
| `npm run check:accessibility` | 检查基础可访问性 |
| `npm run check:responsive` | 检查响应式约束 |
| `npm run check:delivery` | 执行构建和交付检查 |

## 项目结构

```text
src/
├── api/          后端 API 和 SSE 请求
├── assets/       全局样式资源
├── components/   可复用业务组件
├── config/       运行时和环境配置
├── layouts/      页面布局
├── mocks/        本地 Mock 数据
├── router/       路由和访问控制
├── store/        Pinia 状态管理
├── types/        TypeScript 类型定义
├── utils/        SSE、Markdown 和通用工具
└── views/        登录、工作台和管理员页面
tests/            单元测试、组件测试和集成测试
public/           静态资源及运行时配置模板
scripts/          项目质量检查脚本
```

## 后端接口约定

真实 API 模式下，前端默认使用以下能力：

- `/auth/login`、`/auth/me`、`/auth/logout`：账号认证
- `/agent/conversations`：会话和消息历史
- `/chat/chat`：SSE 流式对话
- `/system/user/*`：管理员用户管理
- `/config/*`：系统配置管理
- `/system/prompt/*`：Prompt 版本和发布管理

后端响应应包含项目类型定义所需的字段，并支持前端使用的认证令牌和 SSE 事件格式。详细接口契约可以参考 `src/api/`、`src/types/` 和 `tests/`。

## 安全说明

- 不要提交 `.env`、访问令牌、私钥、数据库密码或真实用户数据。
- 前端构建产物中的地址和功能开关对访问者可见，不能当作机密配置。
- 生产环境应由后端负责认证、授权、敏感数据校验和业务操作幂等控制。

## 许可证

当前仓库未声明开源许可证。如果计划对外开放使用、修改或再分发，请先补充合适的 LICENSE 文件。
