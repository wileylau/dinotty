type TitleTarget = { title: string }

interface TauriWindow {
  setTitle?: (title: string) => void | Promise<void>
}

export interface WindowTitleOptions {
  /** Unread notifications; 0 (default) renders the plain workspace title. */
  unread?: number
  /** DND `dot_sound`: show a dot instead of the count. */
  dotOnly?: boolean
}

export function formatWindowTitle(
  workspaceName?: string,
  options: WindowTitleOptions = {}
): string {
  const base = workspaceName?.trim() || 'Dinotty'
  const unread = Math.max(0, Math.floor(options.unread ?? 0))
  if (unread === 0) return base
  return options.dotOnly ? `● ${base}` : `(${unread}) ${base}`
}

export function updateDocumentTitle(
  workspaceName?: string,
  target: TitleTarget = document,
  options: WindowTitleOptions = {}
): string {
  const title = formatWindowTitle(workspaceName, options)
  target.title = title
  return title
}

export async function setTauriWindowTitle(
  title: string,
  invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>,
  getCurrentWindow: () => TauriWindow | undefined
): Promise<void> {
  try {
    await invoke('set_window_title', { title })
    return
  } catch {}

  try {
    await getCurrentWindow()?.setTitle?.(title)
  } catch {}
}
