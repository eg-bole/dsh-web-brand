# Security Policy（安全策略）

## 支持的版本

| 版本 | 支持状态 |
|---|---|
| 最新 0.1.x | ✅ 积极维护 |
| 更早版本 | ❌ 不维护，请升级 |

本项目跟随 dsh 上游（`@deepseek-ai/dsh-web-app`）的 web flag 集，
上游大版本更新可能导致 flag 镜像失效（见 README「版本注意」），
请保持与所用 dsh 版本匹配。

## 报告漏洞

**请不要**在公开 issue / PR / 讨论里披露安全漏洞细节。

- 首选：GitHub 仓库的 **Security → Report a vulnerability**
  （私有 Security Advisory）。
- 备用：[eg-bole@foxmail.com](mailto:eg-bole@foxmail.com)
  （请勿把敏感信息发到公开渠道）。

收到报告后我们会：确认（通常 72 小时内）→ 评估与修复 →
发布修复版本 → 在适当时间公开披露。

## 安全模型与信任边界

请理解本插件的信任边界，避免误报：

- 插件与 dsh 官方内置插件运行在同一 host 进程内、同一权限级别；
  `dsh web` 本来就是"本地可信用户访问本地服务"的模型，插件不做额外认证。
- 图标路由 `/dsh-web-brand/icon` 带与 `/api` 一致的 browser-trust 围栏
  （`src/fence.ts`）：Host 头为 loopback 或已配置的 trusted host 才放行，
  并拒绝带跨站浏览器标记（`Sec-Fetch-Site` / `Origin`）的请求。
  这是 **DNS rebinding / 跨站读取** 的防御，不是认证。
- 图标本地文件在 dsh 启动时读取一次并缓存（`immutable` + 内容哈希换新），
  之后不重新读盘；改文件后需重启 dsh。
- `--icon` 支持 `http(s)://` 与 `data:` URL 直接透传——写进 `<link>` 的是
  **使用者自己配置**的 URL，请勿指向不可信来源（浏览器加载外部图标可能
  泄露 `Referer` 等）。

### 威胁模型结论

本插件**不会**：引入远程代码执行面、放宽 dsh 的认证/fence 边界、
在 client 里加载非白名单脚本。若某次改动触碰了上述承诺，请按上文渠道
联系我们。

## 感谢

感谢所有负责任地报告安全问题、帮助 dsh 生态更安全的人。
