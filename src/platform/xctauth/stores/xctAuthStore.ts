import { GoTrueClient } from '@supabase/auth-js'
import type { AuthError, Session, User } from '@supabase/auth-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { getXctAuthUrl } from '@/config/xctAuth'
import type { AuthHeader } from '@/types/authTypes'

const STORAGE_KEY = 'xct-auth'

export class XctAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'XctAuthError'
  }
}

function throwOnError(error: AuthError | null): void {
  if (error) {
    throw new XctAuthError(error.message)
  }
}

export const useXctAuthStore = defineStore('xctAuth', () => {
  const client = new GoTrueClient({
    url: getXctAuthUrl(),
    storageKey: STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  })

  const session = ref<Session | null>(null)
  const loading = ref(false)
  const isInitialized = ref(false)

  const user = computed<User | null>(() => session.value?.user ?? null)
  const isAuthenticated = computed(() => session.value !== null)

  async function initialize() {
    if (isInitialized.value) return

    client.onAuthStateChange((_event, nextSession) => {
      session.value = nextSession
    })

    const { data } = await client.getSession()
    session.value = data.session
    isInitialized.value = true
  }

  async function signInWithPassword(email: string, password: string) {
    loading.value = true
    try {
      const { data, error } = await client.signInWithPassword({
        email,
        password
      })
      throwOnError(error)
      session.value = data.session
      return data
    } finally {
      loading.value = false
    }
  }

  async function signUpWithPassword(email: string, password: string) {
    loading.value = true
    try {
      const { data, error } = await client.signUp({ email, password })
      throwOnError(error)
      session.value = data.session
      return data
    } finally {
      loading.value = false
    }
  }

  async function signInWithGoogle(redirectTo?: string) {
    const { error } = await client.signInWithOAuth({
      provider: 'google',
      options: { redirectTo }
    })
    throwOnError(error)
  }

  async function sendPasswordReset(email: string, redirectTo?: string) {
    const { error } = await client.resetPasswordForEmail(email, { redirectTo })
    throwOnError(error)
  }

  async function signOut() {
    const { error } = await client.signOut()
    session.value = null
    if (error) {
      throw new XctAuthError(error.message)
    }
  }

  async function getAccessToken(): Promise<string | null> {
    const { data } = await client.getSession()
    session.value = data.session
    return data.session?.access_token ?? null
  }

  async function getAuthHeader(): Promise<AuthHeader | null> {
    const token = await getAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : null
  }

  return {
    session,
    user,
    loading,
    isInitialized,
    isAuthenticated,
    initialize,
    signInWithPassword,
    signUpWithPassword,
    signInWithGoogle,
    sendPasswordReset,
    signOut,
    getAccessToken,
    getAuthHeader
  }
})
