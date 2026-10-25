# XIV Market

XIV Market 使用 [Universalis](https://universalis.app) 公开 API 直接查询 FFXIV 市场行情。无需后端，纯前端静态部署。

## 功能

- **市场行情浏览** — 查看所有可交易物品的最新价格、历史走势
- **物品搜索** — 支持中文名搜索，快速定位目标物品
- **价格图表** — 基于 Chart.js 的价格分布图和历史走势图
- **服务器选择** — 支持按数据中心 / 服务器 / 区域筛选
- **移动端适配** — 响应式设计，支持手机和桌面端

## 技术栈

- **前端框架**: Solid.js 1.9 + @solidjs/router
- **样式**: Tailwind CSS v4
- **组件库**: Kobalte Core（无障碍原语）
- **构建**: Vite

## 数据来源

### Universalis API

所有市场数据来自 [Universalis](https://universalis.app/) 的公开 API：

| 端点 | 说明 |
|------|------|
| `GET /api/v2/data-centers` | 数据中心列表 |
| `GET /api/v2/worlds` | 服务器列表 |
| `GET /api/v2/marketable` | 可交易物品 ID 列表 |
| `GET /api/v2/{worldDcRegion}/{itemIds}` | 市场挂单数据 |
| `GET /api/v2/history/{worldDcRegion}/{itemIds}` | 交易历史 |
| `GET /api/v2/aggregated/{worldDcRegion}/{itemIds}` | 聚合数据 |

### 物品数据

物品中文名和图标 ID 来自 [thewakingsands/ffxiv-datamining-cn](https://github.com/thewakingsands/ffxiv-datamining-cn) 的 `Item.csv`。

`bun run update-items` 下载 CSV，生成 `data/items.json` 和 `data/items-version.json`。
物品 JSON 通过 [Shadow](https://github.com/AzurIce/shadow) 发布到 TOS，Git 只记录内容哈希 ref 和版本信息。
开发和生产构建均从 `.shadow/refs/data/items.json.ref` 生成 TOS URL，并把相同内容复制到网站的 `items/<sha256>.json`，提供 GitHub Pages 备用源。文件本体继续由 Shadow 管理，不提交 Git。
网页优先请求 TOS；2 秒内未完成时启动 GitHub Pages 备用请求。首个通过 SHA-256 校验和数据解析的来源生效，其他请求会取消；TOS 失败时立即启动备用源。两份数据均绑定当前构建的哈希，防止混用版本。双源都失败时首页显示提示并支持重试，仍可按 ID 搜索。

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 更新并发布物品数据（需要 Shadow 和 TOS 凭证）
bun run update-items
shadow publish

# 构建生产版本
bun run build
```

普通开发和构建不需要 TOS 密钥；`scripts/prepare-items.ts` 优先读取本地 `data/items.json`，缺失时从公开 TOS URL 下载并校验，再生成被 Git 忽略的 `app/public/items/<sha256>.json` 和构建元数据。
需要本地物品数据文件时执行 `shadow restore`。本地更新过 JSON 后，必须先 `shadow publish` 再构建，避免引用旧版本。
Nix 包仍提供 `$out/items.json`，使用 ref 中的 SHA-256 从 TOS 固定获取对应数据。

## 网络诊断

通过设置页的「打开网络诊断」或 `/#/debug`（子路径部署为 `/xiv-market/#/debug`）进入懒加载诊断页。

- **Endpoint 测速**：手动测试两份物品数据、Universalis 数据中心 / 服务器 / 可交易物品列表，以及当前区域与指定物品 ID 的聚合行情、挂单、成交历史。支持正常缓存和绕过浏览器 HTTP 缓存，逐项执行，可停止；显示响应状态、等待、读取、大小和当前缓存模式下成功样本的中位数。
- **请求 Profile**：记录最近 200 个应用 / 测速 JSON 请求的时间线，区分等待响应、读取响应、SHA-256 校验与 JSON 解析，可筛选、清空和查看单次详情。记录仅保存在当前文档内存中，不上传；命中应用 localStorage 缓存的操作不产生网络请求记录。
- **浏览器资源**：查看最近 100 个脚本、样式、图片等资源的 Resource Timing，以及 FCP、文档就绪时间和主线程长任务。跨域源未提供 `Timing-Allow-Origin` 时，DNS、连接、TLS、TTFB、传输大小与缓存命中显示未知，不以 0 代替。

打开页面不会自动运行测速。比较物品源会完整读取两份 JSON，流量大小在页面提示；测速不会替换应用已加载的数据。普通加载只有主源超过 2 秒或失败时才请求备用源。

## 网页与图片共用的物品报表

`@xiv-market/ui/item-report` 导出的 `ItemReportView` 是物品详情页与 bot 截图的唯一展示实现：统计区、NQ/HQ 品质选择、挂单图表、成交走势和明细表均在其中维护。截图通过 `showDetails={false}` 省略明细；`quality` / `onQualityChange` 控制品质。挂单和历史各自严格按该品质过滤，统计区继续分行对比两种品质。

截图默认 HQ，可通过 `render.html?quality=nq` 查询 NQ；不可 HQ 的物品固定 NQ，不显示品质切换。所选品质没有数据时显示空态，不因缺货切换品质。真实网页 `#/item/:id?scope=...&quality=nq` 也接受范围和品质，交互切换会更新 URL；网页未指定品质时保留自动初始选择（优先 HQ，否则 NQ）。

`packages/ui/src/pages/item-detail.tsx` 负责网页路由、请求、取消、刷新和错误通知；View 通过 props 接收物品信息、服务器目录及独立的 market/history 数据状态，不请求行情、不读取全局物品或服务器数据。`ItemIcon` 接收图标 URL，`WorldBadge` 接收服务器目录，调用方负责解析数据。

行情归一化位于 `packages/shared/src/market-normalize.ts`，统计计算位于 `item-report.ts`，服务器索引和范围过滤位于 `world-directory.ts`。网页 API 客户端与外部报表使用同一套归一化函数。

生产构建同时输出 `index.html` 和轻量截图入口 `render.html`。截图入口没有路由和数据加载；调用方在页面执行前注入版本为 1 的 `ItemReport` JSON：

```ts
await page.addInitScript(report => {
  Object.defineProperty(globalThis, '__XIV_MARKET_REPORT__', { value: report })
}, report)
await page.goto(`${baseUrl}/render.html?quality=nq`)
```

JSON 包含 `itemId`、`scope`、`fetchedAtMs`、当前 `item`、`dataCenters`、`worlds`、原始 Universalis `market` / `history` 和 `historyCoverage`，类型见 `packages/shared/src/item-report.ts`。入口将 JSON 转成 View 的 props；不会请求 Universalis 或 `items.json`。旧的 `#/render/item/:id` 路由已删除。

独立截图脚本同样接收报表文件，需要 Python Playwright 及匹配的 Chromium（也可用 `--browser` 指定浏览器路径）：

```bash
python scripts/render_item_report.py --data report.json --quality NQ --out item-report.png
```

运行统计与数据边界测试：`bun run test`。构建后可用匹配的 Playwright/Chromium 检查网页与截图的视觉一致性、品质切换、区域/大区/单服及请求失败：

```bash
XIV_PLAYWRIGHT_CORE=/path/to/playwright-core \
PLAYWRIGHT_BROWSERS_PATH=/path/to/playwright-browsers \
bun run check-report
```

检查结果默认写入 `/tmp/xiv-market-report-check`。可设置 `REPORT_BASELINE_DIST`，对区域、大区、单服的默认 HQ 场景比较重构前的网页构建产物，`REPORT_CHECK_OUTPUT` 指定输出目录。比较固定数据和时间，逐项核对文字、尺寸与像素；允许最多 0.01% 像素存在不超过 32/255 的通道差异，以容纳不同页面外壳下边框的抗锯齿差异。

## 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

构建前会自动检查物品数据是否为最新版本，如果过旧会阻止部署，提示先运行 `bun run update-items` 和 `shadow publish` 更新、发布数据。

Shadow 的 bucket、区域和项目命名空间配置在 `shadow.toml`。本地凭证放在被忽略的 `.env`：

```dotenv
TOS_ACCESS_KEY=your-access-key
TOS_SECRET_KEY=your-secret-key
# TOS_SECURITY_TOKEN=your-temporary-security-token
```

GitHub Actions 使用同名 repository secrets；凭证只用于 Shadow，不注入前端。
每次部署先 `shadow restore`、`shadow publish` 和远端校验，再检查 JSON 的公开读取、CORS、类型及内容哈希，成功后才构建。
TOS 需允许 `https://azurice.github.io` 的跨域 GET/HEAD；本地开发另需允许 `http://localhost:*` 和 `http://127.0.0.1:*`。
可运行 `bun run scripts/check-items-access.ts` 单独验证生产地址。

定时更新流程每 15 分钟检查上游，有变化时生成 JSON、发布到 TOS，再提交 `.shadow/refs/data/items.json.ref` 和 `data/items-version.json` 并触发部署。
手动更新后也应提交这两个文件。

## License

MIT

截图就绪由 `data-render-ready` 通知：可见图表的 `afterRender` 完成、布局测量完成、字体与图片解码完成后，再确认连续两帧布局稳定。截图关闭动画，正常网页保留动画；图表或图片失败时通过 `data-render-error` 返回错误，不输出未完成的图片。调用方等待就绪后可直接截图，无需固定 750ms 等待。`bun run check-render-ready` 验证慢图表、慢图片、慢字体、图标回退、绘制失败和稳定帧；需要匹配的 Playwright / Chromium，以及 `fc-match` 和可加载的本机字体。
