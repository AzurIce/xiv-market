# 前端开发指南

前端设计规范见 [`DESIGN.md`](./DESIGN.md)。本文档专注开发环境、命令和数据说明。

> **注意**: 本文档路径已更新，原 `frontend/` 目录已拆分为 `packages/` 和 `app/`。

## 技术栈

- **框架**: Solid.js 1.9 + @solidjs/router
- **构建**: Vite + vite-plugin-solid
- **样式**: Tailwind CSS v4（shadcn 主题变量）
- **组件**: Kobalte Core（无障碍原语）+ cva（变体管理）
- **包管理**: bun
- **Monorepo**: 共享包在 `frontend/shared/` 和 `frontend/ui/`

## 常用命令

```bash
# 启动开发服务器
bun run dev

# 构建生产版本（GitHub Pages 部署）
bun run build

# 更新物品数据（CI/CD 使用）
bun run update-items
```

## 项目结构

```
packages/
├── shared/              # @xiv-market/shared — 类型、API、工具
│   ├── src/types.ts     # TypeScript 接口
│   ├── src/api.ts       # Universalis API 客户端
│   ├── src/items.ts     # 物品数据加载/查询
│   ├── src/region.ts    # 区域/服务器全局状态
│   ├── src/utils.ts     # cn() = clsx + tailwind-merge
│   ├── src/cva.ts       # class-variance-authority 配置
│   └── src/index.ts     # 统一导出
│
└── ui/                  # @xiv-market/ui — UI 组件 + 页面
    ├── src/primitives/  # Kobalte 包装组件
    ├── src/base/        # 纯 CSS 组件
    ├── src/layout/      # 布局组件（Navbar）
    ├── src/patterns/    # 模式组件（EmptyState、ErrorBoundary）
    ├── src/pages/       # 共享页面（Home、ItemDetail、Settings）
    └── src/index.ts     # 统一导出

app/                     # xiv-market-lite 应用（GitHub Pages 部署）
├── src/App.tsx          # 路由外壳
├── vite.config.ts       # Vite 配置（含 base 路径）
└── public/              # 静态资源（items.json）

scripts/                 # 构建脚本
└── update-items.ts

data/                    # 数据源
└── Item.csv
```

## 物品数据

- 物品中文名/图标映射来自 [thewakingsands/ffxiv-datamining-cn](https://github.com/thewakingsands/ffxiv-datamining-cn) 的 `Item.csv`
- 图标 URL 格式：`https://xivapi.com/i/{folder:06d}/{icon_id:06d}.png`（其中 `folder = icon_id / 1000 * 1000`）
- 物品数据随构建产物部署（`public/items.json`），运行时通过 `fetch('/items.json')` 加载
- commit hash 在构建时注入 JS bundle（`vite.config.ts` → `define`）
- 物品名/图标查询：`@xiv-market/shared` — `getItemName(id)` / `getItemIconUrl(id)` / `getIconUrl(iconId)`

## 外部资源

- [Universalis API 文档](https://docs.universalis.app/)
- [shadcn-solid](https://github.com/hngngn/shadcn-solid) — Solid.js 版 shadcn/ui
- [Kobalte Docs](https://kobalte.dev/docs/core/overview/introduction) — 无障碍组件原语
