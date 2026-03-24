import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { BackgroundSyncBadge } from './BackgroundSyncBadge'

describe('BackgroundSyncBadge', () => {
  it('exibe somente apos o atraso configurado', async () => {
    vi.useFakeTimers()

    render(<BackgroundSyncBadge active delayMs={300} label="Atualizando..." />)

    expect(screen.queryByText('Atualizando...')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(screen.queryByText('Atualizando...')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(screen.queryByText('Atualizando...')).toBeTruthy()

    vi.useRealTimers()
  })

  it('nao exibe quando inativo', () => {
    vi.useFakeTimers()

    render(<BackgroundSyncBadge active={false} delayMs={300} label="Atualizando..." />)

    vi.advanceTimersByTime(400)
    expect(screen.queryByText('Atualizando...')).toBeNull()

    vi.useRealTimers()
  })
})
