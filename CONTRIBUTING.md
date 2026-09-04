# Contributing（贡献指南）

欢迎任何形式的贡献：报告 issue、翻译、补测试、修 bug、加功能、改文档。
请先花两分钟读完本文件，能帮你避免大多数返工。

## 环境要求

- Node.js `^22.19.0 || >=24.0.0`（与 dsh 上游一致），npm 10+。
- 本仓库是纯前端构建，不需要 pnpm / yarn（`package-lock.json` 是 npm 生成的）。

```bash
npm install
```

## 常用命令

| 命令 | 作用 |
|---|---|
| `npm test` | vitest 单元测试（纯逻辑 + 假 host 集成，不需要 cordis 运行树） |
| `npm run typecheck` | `tsc --noEmit` 全量类型检查 |
| `npm run build` | tsdown 构建：`lib/index.js` + `lib/startup.js`（node ESM）+ `lib/client.js`（浏览器闭包）+ dts |
| `npm pack` | 打包发布产物（自动先 build；`prepack` 钩子） |

提交前请保证：`npm run typecheck`、`npm test`、`npm run build` 全绿。
CI（GitHub Actions）也会跑同样的检查，见 `.github/workflows/ci.yml`。

## 怎么改、往哪儿改

先读 README 的「工作原理（一句话版）」与「结构」，理解两半架构：

- **host 半**（`src/*.ts`）：跑在 dsh 的 node 进程里。
  `startup.ts` 是 flag provider（替换官方 `web-startup`），
  `index.ts` 是 branding 行（三通道合并 + tapIndex 改写 + global 行 + 图标路由），
  `branding.ts` / `fence.ts` / `types.ts` 是纯逻辑与类型镜像。
- **client 半**（`src/client/*.ts`）：跑在浏览器里，编译进 `lib/client.js`
  的 `__ModuleLoader__` 闭包，只读 host 注入的 `globalThis.__DSH_WEB_BRAND__`，
  观察并改写 `<title>`。

约定（改动前务必理解，避免破坏语义）：

1. **品牌永远是前缀**。默认页 `Yao - DeepSeek Harness`，会话页
   `Yao - <会话名> — DeepSeek Harness`。品牌分隔符是 ` - `（host 通过 global 行
   下发 `sep`，client 优先读它，常量 `DEFAULT_SEPARATOR`）。
2. **host 尽量不动 core、不依赖 @deepseek-ai 运行时类型**：`types.ts` 是结构
   镜像，`cordis`/`dsh-cmdline` 是 optional peer，运行期从 dsh 安装树解析。
3. **client 半零运行时依赖**：不要往 client 引入 npm 包，否则要改构建与
   client-modules 发现逻辑。
4. **新增行为要有测试**：纯逻辑放 `tests/branding.spec.ts` /
   `tests/title.spec.ts`；涉及 host 注册的用假 host 上下文（tap / global 行 /
   路由 / fence），见 `tests/host.spec.ts`。

## 端到端验证（可选但强烈建议）

改动涉及 flag 解析、tapIndex 或 client 加载路径时，请对着真实 dsh 跑一次。
用**临时 DSH_HOME**，绝不动真实 profile：

```bash
E2E=$(mktemp -d)

npm pack >/dev/null                        # 产出 dsh-web-brand-<ver>.tgz（prepack 自动构建）
PKG=$(node -p "'dsh-web-brand-'+require('./package.json').version+'.tgz'")
DSH_HOME=$E2E dsh plugin --profile web add ./"$PKG"

DSH_HOME=$E2E dsh web --title SmokeTest --port 0 --no-open > "$E2E/boot.log" 2>&1 &
SRV=$!
for i in $(seq 1 50); do grep -q 'http://127' "$E2E/boot.log" && break; sleep 0.2; done

URL=$(grep -oE 'http://127\.0\.0\.1:[0-9]+[^ ]*' "$E2E/boot.log" | head -1)
echo "URL=$URL"
curl -fsS "$URL" | grep -F '<title>SmokeTest - DeepSeek Harness</title>'
curl -fsS "$URL" | grep -F '__DSH_WEB_BRAND__'           # 应含 "customIcon":false,"statusLight":true
curl -fsS "$URL" | grep -F 'dsh-api-session-controller'  # 状态灯的 sessions 服务已预载

kill "$SRV" 2>/dev/null
rm -rf "$E2E"                              # 清理；用 $SRV kill，别用 pkill 模式匹配
```

`--port 0` 让 dsh 自己挑空闲端口，避免和正在跑的 dsh 实例撞车。

## 提 PR 流程

1. Fork 本仓库，从 `main` 开分支：`git checkout -b feat/xxx`。
2. 改代码 + 补测试/文档，跑完上面三个命令。
3. 有行为变化时更新 `CHANGELOG.md`（在 `Unreleased` 或新版本小节里加条目）。
4. 提交信息用一句话说清"为什么"（不必强求 conventional commits，但建议
   `feat: / fix: / docs: / chore:` 前缀），推分支后开 PR。
5. CI 绿即可合入；小改动也可以直接开 PR 讨论。

## 发布流程（维护者）

见 README「🚀 发布 / 开源清单」。核心是：推到 GitHub → 打 `v*` tag →
`.github/workflows/npm-publish.yml` 自动 `npm publish`（需要在仓库
Settings → Secrets → Actions 里配好 `NPM_TOKEN`，且 `package.json` 的
`repository` 字段指向 GitHub 仓库以启用 provenance）。

## 报告问题

- 使用问题、想法：开 issue（附 `dsh --version`、dsh 版本、profile 配置）。
- 安全问题：见 [SECURITY.md](SECURITY.md)，**不要**在公开 issue 里贴漏洞细节。
