import { describe, expect, it, vi } from 'vitest'
import { formatWindowTitle, setTauriWindowTitle, updateDocumentTitle } from '../utils/windowTitle'

describe('window title', () => {
  it('updates the title when the active workspace changes', () => {
    const target = { title: '' }

    updateDocumentTitle('Default', target)
    expect(target.title).toBe('Default')

    updateDocumentTitle('Project Atlas', target)
    expect(target.title).toBe('Project Atlas')
  })

  it('uses the application name when the workspace name is empty', () => {
    expect(formatWindowTitle()).toBe('Dinotty')
    expect(formatWindowTitle('   ')).toBe('Dinotty')
  })

  it('prefixes unread notifications as a count', () => {
    expect(formatWindowTitle('Project Atlas', { unread: 1 })).toBe('(1) Project Atlas')
    expect(formatWindowTitle('Project Atlas', { unread: 12 })).toBe('(12) Project Atlas')
    expect(formatWindowTitle('', { unread: 2 })).toBe('(2) Dinotty')
  })

  it('renders a dot instead of the count for dot-only DND', () => {
    expect(formatWindowTitle('Project Atlas', { unread: 3, dotOnly: true })).toBe(
      '● Project Atlas'
    )
  })

  it('ignores invalid or cleared unread counts', () => {
    expect(formatWindowTitle('Project Atlas', { unread: 0 })).toBe('Project Atlas')
    expect(formatWindowTitle('Project Atlas', { unread: -2 })).toBe('Project Atlas')
  })

  it('falls back to the window API when the command fails', async () => {
    const invoke = vi.fn(async () => {
      throw new Error('command unavailable')
    })
    const setTitle = vi.fn(async () => {})

    await setTauriWindowTitle('Project Atlas', invoke, () => ({ setTitle }))

    expect(invoke).toHaveBeenCalledWith('set_window_title', {
      title: 'Project Atlas',
    })
    expect(setTitle).toHaveBeenCalledWith('Project Atlas')
  })

  it('absorbs synchronous fallback errors and rejected title updates', async () => {
    const invoke = vi.fn(async () => {
      throw new Error('command unavailable')
    })

    await expect(
      setTauriWindowTitle('Dinotty', invoke, () => {
        throw new Error('window API unavailable')
      })
    ).resolves.toBeUndefined()

    await expect(
      setTauriWindowTitle('Dinotty', invoke, () => ({
        setTitle: () => Promise.reject(new Error('title update failed')),
      }))
    ).resolves.toBeUndefined()
  })
})
