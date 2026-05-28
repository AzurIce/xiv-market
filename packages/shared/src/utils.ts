import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 获取当前部署的 base URL，用于拼接静态资源路径。
 * GitHub Pages 子目录部署时，Vite 的 `import.meta.env.BASE_URL`
 * 会被设置为 `/xiv-market-lite/`，但开发环境仍为 `/`。
 */
export function baseUrl(): string {
  const base = import.meta.env.PROD ? import.meta.env.BASE_URL : '/'
  // 去掉末尾斜杠，避免拼接出双斜杠（如 /xiv-market-lite//huiji.webp）
  return base.replace(/\/$/, '') || '/'
}
