<div align="center">

# dsh-web-brand

**给 `dsh web` 打上服务器标识的品牌前缀标题 + 自定义 favicon**

同时开多个 dsh 服务器时，浏览器页签长得一模一样，根本分不清谁是谁。装上本插件后，每个服务器的页签都带上你指定的品牌前缀：

```
无标题配置时：  DeepSeek Harness                （默认）
--title Yao：   Yao - DeepSeek Harness          （默认页）
                Yao - 我的会话 — DeepSeek Harness  （会话页）
```

纯插件实现 · 不改 dsh 核心 · 值为 flag / 环境变量 / profile 配置三通道

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## ✨ 特性

- **标题前缀**：品牌始终在最前，页签扫一眼就能区分服务器；无会话（默认页）与有会话（`会话名 — DeepSeek Harness`）两种形态都统一加前缀。
- **首帧即正确**：host 端直接改写伺服出去的 `index.html`（`<title>` 与 `<link rel="icon">`），JS 运行前页签就已是品牌形态；会话标题变化时再由浏览器端观察器补前缀，无闪烁。
- **图标多格式**：本地文件支持 `svg / png / ico / jpg / jpeg / webp / gif / avif`，按扩展名给正确的 `Content-Type`；也支持 `http(s)://` 与 `data:` URL 直接透传。
- **三通道取值**（优先级从高到低）：
  1. CLI flag：`dsh web --title Yao --icon ./brand.png`
  2. 环境变量：`DSH_WEB_BRAND_TITLE=Yao DSH_WEB_BRAND_ICON=./brand.png dsh web`
  3. profile 行配置：写进 `$DSH_HOME/profiles/web/cordis.patch.yml`（一劳永逸，一台服务器一份 profile）
- **零残留**：所有注册（index 改写、global 行、图标路由）都挂在 `ctx.effect` 上，卸载即复原。

## 📦 安装

```bash
# 本地打包（或发布到 npm 后直接用包名）
npm pack                 # 产出 dsh-web-brand-0.1.0.tgz

# 装入 web profile（自动把插件 bundle 追加进 profile 的 bundles 栈）
dsh plugin --profile web add ./dsh-web-brand-0.1.0.tgz

# 重启 dsh web 后生效
```

> 版本注意：插件会接管 `dsh web` 的 flag 解析（禁用官方 `web-startup` 行，插入
> 自己的超集 provider），镜像的是 dsh 0.1.x 的 web flag 集
> （`--host/--port/--no-open/--trusted-host`）。上游给 web 新增 flag 时需同步
> `src/startup.ts`。

## 🚀 用法

```bash
# flag（每次启动带）
dsh web --title Yao --icon /path/to/brand.png

# flag + 环境变量
DSH_WEB_BRAND_TITLE=Yao DSH_WEB_BRAND_ICON=https://example.com/favicon.svg dsh web

# profile 配置（持久，最省心）—— 编辑 $DSH_HOME/profiles/web/cordis.patch.yml：
# - id: web-brand
#   config:
#     title: Yao
#     icon: /home/me/brand/prod.svg
```

## 🖼 图标格式支持

| 扩展名 | Content-Type | 浏览器兼容 |
|---|---|---|
| `.svg` | `image/svg+xml` | 现代浏览器全支持 |
| `.png` | `image/png` | 全支持 |
| `.ico` | `image/x-icon` | 全支持（含多尺寸 ICO） |
| `.jpg` `.jpeg` | `image/jpeg` | 现代 Chromium / Firefox |
| `.webp` | `image/webp` | 现代 Chromium / Firefox |
| `.gif` | `image/gif` | 现代 Chromium / Firefox |
| `.avif` | `image/avif` | 现代 Chromium / Firefox |

本地文件启动时读取一次并按内容哈希缓存（`/dsh-web-brand/icon?rev=<hash>`，
`immutable` 缓存头，改文件后重启即换新）；路由带与 `/api` 一致的 browser-trust
围栏。外部 URL 与 `data:` URL 直接写入 `<link rel="icon">`，不经过插件路由。

## ⚙️ 工作原理（一句话版）

```
dsh web --title Yao --icon ./x.png
  → 插件 startup 行（取代官方 web-startup）解析 flag，provide 同一个 webStartup service（含 title/icon）
  → 插件 branding 行合并 flag > env > profile config
  → tapIndex 改写每次伺服出去的 <title> 与 <link rel="icon">（首帧即正确）
  → index-inject 注入 global 行：globalThis.__DSH_WEB_BRAND__ = { title, sep }
  → 浏览器端观察 <title>，给 dsh 写的标题统一加前缀（自带防循环 guard）
```

## 🧪 开发

```bash
npm install
npm test          # vitest：纯逻辑 + 假 host 集成（无需 cordis 树）
npm run typecheck
npm run build     # tsdown：lib/index.js + lib/startup.js（node ESM）+ lib/client.js（浏览器闭包）
npm pack
```

## 📁 结构

```
cordis.patch.yml      # 禁用官方 web-startup + 插入 web-brand-startup / web-brand 两行
src/startup.ts        # host：superset commander，provide webStartup（含 title/icon）
src/index.ts          # host：三通道合并 + tapIndex 改写 + global 行 + 图标路由
src/branding.ts       # 纯函数：index.html 改写、MIME 映射、哈希
src/fence.ts          # 路由 browser-trust 围栏（行为同 /api 的 fence）
src/types.ts          # host 面的结构化类型镜像（不依赖任何 @deepseek-ai 类型）
src/client/index.ts   # browser：<title> 前缀观察器
src/client/title.ts   # 纯函数：brandedTitle（前缀 + 防循环 guard）
```

## ⚠️ 边界

- **flag 接管是"独占"的**：同一 profile 里只能有一个插件接管 `web-startup`。
- PWA manifest 的 `name` 仍是 "DeepSeek Harness"（只影响"安装到桌面"的应用名，不影响页签/书签）。
- static worker preview 页不走服务端改写（tapIndex 无效），但 global 行随 boot payload
  送达，浏览器端前缀依然生效——只差 JS 前的首帧。
- 分隔符固定为 ` - `（页签宽度友好）；如需改，host `DEFAULT_SEPARATOR` 与 client
  常量同步改一处即可（host 会把分隔符随 global 行下发，client 优先读它）。

## 📄 License

MIT。`src/fence.ts` 为 `@deepseek-ai/dsh-client-connection` 的
`api-request-trust.ts` / `loopback-hostname.ts` 的 BSD-3-Clause 复刻
（与 dsh-better-sidebar-icons 同源同注），见文件头注释。
