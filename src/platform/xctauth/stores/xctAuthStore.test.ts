import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { XctAuthError, useXctAuthStore } from './xctAuthStore'

const mocks = vi.hoisted(() => {
  const client = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    })),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signInWithOAuth: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    signOut: vi.fn()
  }
  return { client }
})

vi.mock('@supabase/auth-js', () => ({
  GoTrueClient: vi.fn().mockImplementation(function () {
    return mocks.client
  })
}))

function sessionWith(accessToken: string) {
  return {
    access_token: accessToken,
    user: { id: 'user-1', email: 'a@b.c' }
  }
}

describe('useXctAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.client.getSession.mockResolvedValue({ data: { session: null } })
  })

  it('builds a Bearer auth header from the current access token', async () => {
    mocks.client.getSession.mockResolvedValue({
      data: { session: sessionWith('jwt-123') }
    })
    const store = useXctAuthStore()

    expect(await store.getAuthHeader()).toEqual({
      Authorization: 'Bearer jwt-123'
    })
  })

  it('returns no auth header when there is no session', async () => {
    const store = useXctAuthStore()

    expect(await store.getAuthHeader()).toBeNull()
  })

  it('exposes the user and authentication state after sign-in', async () => {
    mocks.client.signInWithPassword.mockResolvedValue({
      data: { session: sessionWith('jwt-xyz') },
      error: null
    })
    const store = useXctAuthStore()

    await store.signInWithPassword('a@b.c', 'pw')

    expect(store.isAuthenticated).toBe(true)
    expect(store.user?.id).toBe('user-1')
  })

  it('wraps provider errors as XctAuthError with the original message', async () => {
    mocks.client.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' }
    })
    const store = useXctAuthStore()

    await expect(store.signInWithPassword('a@b.c', 'bad')).rejects.toThrow(
      new XctAuthError('Invalid login credentials')
    )
  })

  it('resets loading after a failed sign-in', async () => {
    mocks.client.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'nope' }
    })
    const store = useXctAuthStore()

    await expect(
      store.signInWithPassword('a@b.c', 'bad')
    ).rejects.toBeInstanceOf(XctAuthError)
    expect(store.loading).toBe(false)
  })
})
