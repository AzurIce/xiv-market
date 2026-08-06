import { Toast, toaster } from '@kobalte/core/toast'

import { Button } from './button'

// toast 是错误提示的"有内容"落点：刷新失败等瞬时错误浮现于内容之上，
// 不阻断当前展示。无内容时错误走 EmptyState 错误屏，不弹 toast

// 挂在 App 根部的 toast 容器：右下角堆叠
export function AppToastRegion() {
  return (
    <Toast.Region duration={8000} limit={3} swipeDirection="right">
      <Toast.List class="fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2 outline-none" />
    </Toast.Region>
  )
}

export function toastError(message: string, opts?: { title?: string; onRetry?: () => void }) {
  return toaster.show((props) => (
    <Toast
      toastId={props.toastId}
      class="relative flex items-start gap-3 rounded-xl border border-border bg-background p-4 pr-10 shadow-md"
    >
      <svg
        class="mt-0.5 size-4 shrink-0 text-destructive"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <div class="min-w-0 flex-1">
        <Toast.Title class="text-sm font-medium">{opts?.title ?? '刷新失败'}</Toast.Title>
        <Toast.Description class="mt-0.5 text-sm text-muted-foreground break-words">
          {message}
        </Toast.Description>
        {opts?.onRetry && (
          <Button
            variant="link"
            size="sm"
            class="mt-1.5 h-auto p-0"
            onClick={() => {
              opts.onRetry!()
              toaster.dismiss(props.toastId)
            }}
          >
            重试
          </Button>
        )}
      </div>
      <Toast.CloseButton
        class="absolute right-2 top-2 flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="关闭"
      >
        <svg
          class="size-3.5"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </Toast.CloseButton>
    </Toast>
  ))
}
