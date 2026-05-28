# XIV Market Lite

XIV Market 的轻量版，使用 [Universalis](https://universalis.app) 公开 API 直接查询 FFXIV 市场行情。无需后端，纯前端静态部署。

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
- **部署**: GitHub Pages

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

构建时通过 `bun run update-items` 自动下载并生成 `items.json`。

## 与 Universalis 官方网页对比

| 特性 | Universalis 官方 | XIV Market Lite |
|------|-----------------|-----------------|
| **后端架构** | 自有服务器 + 数据库 | 无后端，浏览器直接调用 Universalis API |
| **部署方式** | 中心化服务 | 纯静态站点，可自托管到任意静态托管平台 |
| **图表类型** | 价格走势折线图 + 堆叠柱状图 | 价格分布小提琴图 + 历史走势图 |
| **技术栈** | 未公开 | Solid.js + Tailwind CSS + Vite（现代化前端栈） |

## 开发

```bash
# 安装依赖
bun install

# 启动开发服务器
bun run dev

# 更新物品数据（当游戏版本更新时）
bun run update-items

# 构建生产版本
bun run build
```

## 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages。

构建前会自动检查 `items.json` 是否为最新版本，如果过旧会阻止部署，提示先运行 `bun run update-items` 更新数据。

## License

MIT
