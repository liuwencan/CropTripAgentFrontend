# 部署配置

构建产物是静态文件。生产环境优先通过 `public/runtime-config.js` 注入配置，部署后只替换这个文件并刷新页面即可切换后端地址或功能开关，不需要重新构建前端。

```js
window.__APP_CONFIG__ = {
  apiBaseUrl: 'http://127.0.0.1:8080',
  streamBaseUrl: 'http://127.0.0.1:8080',
  appTitle: '企业差旅助手',
  enableMock: false,
  features: {
    admin: true,
    travelWorkflow: true,
  },
}
```

`apiBaseUrl` 用于普通 JSON API，`streamBaseUrl` 用于 SSE 对话接口。地址必须是 HTTP(S) 地址或同源相对路径；配置不合法时应用会在启动阶段阻止业务请求。开发环境可以使用 `.env` 中的 `VITE_API_BASE_URL`、`VITE_STREAM_BASE_URL`、`VITE_APP_TITLE` 和 `VITE_ENABLE_MOCK`，它们会作为运行时配置缺失时的回退值。

部署服务应避免长期缓存 `runtime-config.js`，或在文件 URL 上附加版本查询参数。回滚时恢复上一份静态资源和配置文件即可。
