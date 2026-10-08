# Changelog

本项目的所有显著变更都会记录在此文件中。

格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)（SemVer）。

## [0.1.2] - 2026-10-08

### 修复

- **兼容 dsh 0.2.x**：`peerDependencies` 里的 `@deepseek-ai/dsh-cmdline` /
  `@deepseek-ai/dsh-api-session-controller` 从 `^0.1.2-rc.1` 改为
  `>=0.1.7-rc.2 <0.3.0`。旧范围让插件管理器在 dsh 0.2.0-rc.2 上直接拒绝安装
  （`Plugin dsh-web-brand@0.1.1 is incompatible with dsh 0.2.0-rc.2`）。
- **状态灯改读官方现役数据源**：dsh 0.1.x 已删除客户端会话 store 的
  `SessionListState.current` 与 `SessionSummary.completed`——插件此前读的正是这两个
  字段，所以状态灯自 dsh 0.1.7 起一直静默失效（绿/琥珀永不出现）。现在改为 join
  官方 `ctx.sessions.list`（目录行 + `origin: 'subagent'`）与
  `ctx.uiSession.sessionStatus`（`completionUnread` / `pendingInteraction`），
  与官方工作区行的取数方式一致（`ui-workspace` `src/client/tree.ts` 的 `sessionNode`）。
  - 「切走期间完成」改由官方的 `completionUnread` 表达，插件不再自行追踪 running
    边沿；因此熄灭时机从「切回本页签」变为「打开该会话」（与官方侧边栏状态点一致）。
  - 琥珀只对官方 UI 真正展示的交互类型（`approval` / `plan-review` / `question`）
    生效，避免不可见类型的挂起请求让 favicon 永久卡在琥珀色。
  - `ctx.uiSession` 为可选依赖：profile 未组装官方会话 UI 时，标题前缀照常生效，
    favicon 保持不动。

### 新增

- **`--public-url` 支持**：上游 dsh 在 0.2.x 给 web flag 集新增了 `--public-url`
  （反代场景对外广播的 HTTP(S) 根）。插件的超集 provider 现在一并镜像该 flag，
  并复刻官方 `parsePublicUrl` 校验（`src/public-url.ts`，BSD-3-Clause；见文件头）。
  在 0.2.0-rc.2 上该值无消费者，接受它是无害的。

## [0.1.1] - 2026-09-05

### 新增

- **鲸鱼状态灯（不配 icon 时默认启用）**：借鉴 [dsh-done-whale](https://github.com/wally8-8/dsh-done-whale)
  的"favicon 当状态灯"思路——没有自定义图标时，浏览器端把官方鲸鱼 favicon 按
  会话状态临时换色：主会话完成变绿（`#22C55E`）、有待处理交互变琥珀（`#F59E0B`）、
  回台前熄灭；配了自定义 icon 的 profile 完全不受影响。
- 客户端现在消费官方 `ctx.sessions` 服务（`@deepseek-ai/dsh-api-session-controller`
  随 dsh web 自带），manifest `dsh.client.inject` 声明注入、client bundle 导出
  `inject: ['sessions']`。
- host 的 `__DSH_WEB_BRAND__` global 行扩展为
  `{ title?, sep, customIcon, statusLight }`；profile 行配置新增
  `statusLight: false` 可显式关闭状态灯（此时无任何标题/图标/状态灯配置的安装
  才是完全 no-op）。

### 说明

- 状态灯图形取自已安装 dsh 的 `@deepseek-ai/dsh-web-frontend` 官方
  `favicon.svg`（BSD-3-Clause），见 `src/client/whale.ts` 头注。

## [0.1.0] - 2026-09-04

### 新增

- **`dsh web --title <brand>` / `--icon <path|URL|data:>` 两个新 flag**：
  通过禁用官方 `web-startup` 行并插入同名 service（`webStartup`）的超集 provider
  接管 web flag 解析；镜像 dsh 0.1.x 的 `--host/--port/--no-open/--trusted-host`。
- **首帧即正确的标题前缀**：host 端 tapIndex 改写每次伺服出去的 `index.html`
  （`<title>` 与 `<link rel="icon">`），默认页形如 `Yao - DeepSeek Harness`，
  无需等待任何 JS。
- **会话标题持续加前缀**：浏览器端 `<title>` 观察器（MutationObserver +
  防循环 guard）给 dsh 后续写出的标题统一加品牌前缀，
  形如 `Yao - 我的会话 — DeepSeek Harness`。
- **多格式 favicon**：本地文件支持 `svg / png / ico / jpg / jpeg / webp / gif / avif`，
  按扩展名给出正确 `Content-Type`；`http(s)://` 与 `data:` URL 直接透传。
  本地图标启动时读取一次，按内容哈希做 `immutable` 缓存。
- **三通道取值**（优先级从高到低）：CLI flag > 环境变量
  （`DSH_WEB_BRAND_TITLE` / `DSH_WEB_BRAND_ICON`）> profile 行配置
  （`cordis.patch.yml` 中 `web-brand` 行的 `config`）。
- **路由信任围栏**：图标路由带与 `/api` 一致的 browser-trust 围栏
  （loopback / trusted host + 跨站浏览器标记检查），`src/fence.ts` 为
  BSD-3-Clause 复刻，来源见文件头与 README。
- **零残留**：全部注册挂在 `ctx.effect` 上，热重载 / 卸载即复原。

### 说明

- flag 接管是"独占"的：同一 profile 内只能有一个插件接管 `web-startup`。
- 上游（`@deepseek-ai/dsh-web-app`）给 web flag 集新增 flag 时，需同步
  `src/startup.ts`（见 README「版本注意」）。
