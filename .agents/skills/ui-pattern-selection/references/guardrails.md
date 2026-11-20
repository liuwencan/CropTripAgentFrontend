# 护栏：无障碍 / 性能 / 安全红线

> 决策点索引：无障碍规则、性能基线、安全红线（XSS/Token/CSRF/CSP/上传/供应链）。**本章全部 🔴 MUST，任何情况不违反。**

## 无障碍（🔴）

| 项 | 规则 |
|---|---|
| 键盘可达 | 所有交互元素可键盘操作 |
| 焦点可见 | **:focus-visible（禁止 outline: none）** |
| 图标按钮 | 必有 aria-label 或 tooltip |
| 弹窗焦点 | 打开聚焦、关闭归还 |
| 对比度 | 4.5:1（WCAG 2.1 AA，**深色模式单独重验**） |
| 状态指示 | 颜色不能是唯一指示（配图标/文字） |
| 动态区域 | toast/进度/异步内容加 aria-live（polite 播报，错误 assertive） |
| 表单错误 | aria-invalid + aria-describedby 关联输入框 |
| 标题层级 | 每页一个 h1，按层级递进不跳级 |

## 性能（🔴 基线）

| 项 | 规则 |
|---|---|
| 大列表 | 虚拟化 |
| 图片 | **懒加载（唯一权威定义）+ 响应式图片 srcset/sizes** |
| 弹窗 | 懒渲染（打开才挂载） |
| 动效 | ≤200ms 且尊重 prefers-reduced-motion |
| 字体 | font-display: swap |
| 代码分割 | 路由级代码分割 |
| 首屏指标 | 基线 LCP ≤2.5s / CLS ≤0.1 / INP ≤200ms（Core Web Vitals） |

## 安全红线（🔴）

| 红线 | 规则 |
|---|---|
| XSS | 富文本渲染必须白名单净化（DOMPurify）；**v-html 禁止直接渲染用户输入**；URL/属性注入防护 |
| **Token 存储（双方案决策）** | 方案 A（高安全）：httpOnly cookie —— XSS 读不到，但**必须配套 CSRF 防护**；方案 B（简单）：Authorization header + 非敏感存储 —— 实现简单，但 XSS 可窃取。按项目安全等级选，选 A 则 CSRF 项必做 |
| CSRF | 方案 A 时必做（token/双提交 cookie/同源校验）；方案 B 时 Header 认证天然免疫大部分 CSRF |
| CSP | Content-Security-Policy 约束内联脚本/第三方 CDN |
| 点击劫持 | 敏感页面配置 X-Frame-Options / frame-ancestors |
| 上传 | 前端类型/大小校验 + **服务端二次校验**（前端校验可绕过） |
| 供应链 | 第三方依赖审查；锁版本 |
| 敏感数据 | 密码字段 autocomplete 策略；不缓存敏感响应；**日志脱敏**（前端日志不打 token/密码） |
