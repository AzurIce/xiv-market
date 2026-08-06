import { createEffect, on } from 'solid-js'
import { toastError } from './toast'

/**
 * 错误提示落点：error 从 null → 有值 且当前有内容时弹 toast（非阻断）。
 * 无内容时不弹——此时错误以 EmptyState 错误屏呈现，避免同一错误两处重复。
 */
export function useErrorToast(error: () => string | null, hasData: () => boolean, onRetry: () => void) {
  createEffect(
    on(error, (msg) => {
      if (msg && hasData()) toastError(msg, { onRetry })
    }),
  )
}
