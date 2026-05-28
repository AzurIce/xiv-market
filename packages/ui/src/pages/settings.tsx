import { Show } from 'solid-js'
import { A } from '@solidjs/router'
import { getItemsVersionInfo, type ItemsVersionInfo } from '@xiv-market/shared'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../card'
import { Badge } from '../badge'
import { PageHeader } from '../page-header'
import { Separator } from '../separator'

export default function Settings() {
  const versionInfo = (): ItemsVersionInfo | null => getItemsVersionInfo()

  return (
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="mb-2">
        <A href="/" class="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
          <svg class="mr-1 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          返回市场
        </A>
      </div>

      <PageHeader
        title="设置"
        description="物品数据版本信息"
      />

      <div class="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>物品数据版本</CardTitle>
            <CardDescription>
              数据来自{' '}
              <a
                href="https://github.com/thewakingsands/ffxiv-datamining-cn"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                thewakingsands/ffxiv-datamining-cn
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <Show
              when={versionInfo()}
              fallback={
                <div class="flex items-center gap-2 text-muted-foreground">
                  <div class="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  数据加载中...
                </div>
              }
            >
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p class="text-sm text-muted-foreground mb-1">Commit</p>
                  <p class="font-mono text-sm">
                    <a
                      href={`https://github.com/thewakingsands/ffxiv-datamining-cn/commit/${versionInfo()!.commit}`}
                      target="_blank" rel="noopener noreferrer"
                      class="text-primary hover:underline"
                    >
                      {versionInfo()!.commit}
                    </a>
                  </p>
                </div>
                <div>
                  <p class="text-sm text-muted-foreground mb-1">Commit 日期</p>
                  <p class="text-sm font-medium">{versionInfo()!.date || '-'}</p>
                </div>
                <div>
                  <p class="text-sm text-muted-foreground mb-1">物品数量</p>
                  <p class="text-sm font-medium">{versionInfo()!.itemCount.toLocaleString('zh-CN')}</p>
                </div>
              </div>

              <Separator />

              <div class="flex items-center gap-2">
                <span class="text-sm text-muted-foreground">部署方式</span>
                <Badge variant="secondary">构建产物</Badge>
              </div>
            </Show>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
