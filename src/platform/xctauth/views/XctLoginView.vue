<template>
  <div class="flex size-full items-center justify-center px-4 py-8">
    <div class="flex w-full max-w-sm flex-col gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="my-0 text-2xl font-extrabold text-base-foreground">
          {{ isSignUp ? t('xctAuth.signUpTitle') : t('xctAuth.title') }}
        </h1>
        <p class="my-0 text-sm text-muted-foreground">
          {{ t('xctAuth.subtitle') }}
        </p>
      </div>

      <p
        v-if="message"
        :class="
          cn(
            'my-0 rounded-md px-3 py-2 text-sm',
            isError
              ? 'bg-error-background text-error-foreground'
              : 'bg-secondary-background text-muted-foreground'
          )
        "
      >
        {{ message }}
      </p>

      <Button
        variant="secondary"
        class="h-10 w-full"
        :loading="googleLoading"
        @click="onGoogle"
      >
        <i class="pi pi-google" />
        {{ t('xctAuth.continueWithGoogle') }}
      </Button>

      <div class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="h-px flex-1 bg-border-default" />
        {{ t('xctAuth.or') }}
        <span class="h-px flex-1 bg-border-default" />
      </div>

      <form class="flex flex-col gap-3" @submit.prevent="onSubmit">
        <label class="flex flex-col gap-1 text-sm text-muted-foreground">
          {{ t('xctAuth.email') }}
          <Input
            v-model="email"
            type="email"
            autocomplete="email"
            :placeholder="t('xctAuth.emailPlaceholder')"
            required
          />
        </label>

        <label class="flex flex-col gap-1 text-sm text-muted-foreground">
          {{ t('xctAuth.password') }}
          <Input
            v-model="password"
            type="password"
            :autocomplete="isSignUp ? 'new-password' : 'current-password'"
            :placeholder="t('xctAuth.passwordPlaceholder')"
            required
          />
        </label>

        <Button type="submit" class="mt-1 h-10 w-full" :loading="loading">
          {{ isSignUp ? t('xctAuth.signUp') : t('xctAuth.signIn') }}
        </Button>
      </form>

      <div
        class="flex items-center justify-between text-sm text-muted-foreground"
      >
        <button
          type="button"
          class="cursor-pointer border-none bg-transparent p-0 text-azure-600"
          @click="toggleMode"
        >
          {{ isSignUp ? t('xctAuth.haveAccount') : t('xctAuth.noAccount') }}
        </button>
        <button
          v-if="!isSignUp"
          type="button"
          class="cursor-pointer border-none bg-transparent p-0 text-muted-foreground hover:text-base-foreground"
          @click="onForgotPassword"
        >
          {{ t('xctAuth.forgotPassword') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import Button from '@/components/ui/button/Button.vue'
import Input from '@/components/ui/input/Input.vue'
import {
  XctAuthError,
  useXctAuthStore
} from '@/platform/xctauth/stores/xctAuthStore'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useXctAuthStore()

const email = ref('')
const password = ref('')
const isSignUp = ref(false)
const loading = ref(false)
const googleLoading = ref(false)
const message = ref('')
const isError = ref(false)

function show(text: string, error: boolean) {
  message.value = text
  isError.value = error
}

function errorText(e: unknown): string {
  return e instanceof XctAuthError ? e.message : t('xctAuth.genericError')
}

function redirectTarget(): string {
  const target = route.query.redirect
  return typeof target === 'string' ? decodeURIComponent(target) : '/'
}

function toggleMode() {
  isSignUp.value = !isSignUp.value
  message.value = ''
}

async function onSubmit() {
  loading.value = true
  message.value = ''
  try {
    if (isSignUp.value) {
      const { session } = await authStore.signUpWithPassword(
        email.value,
        password.value
      )
      if (session) {
        await router.replace(redirectTarget())
      } else {
        show(t('xctAuth.checkEmail'), false)
      }
    } else {
      await authStore.signInWithPassword(email.value, password.value)
      await router.replace(redirectTarget())
    }
  } catch (e) {
    show(errorText(e), true)
  } finally {
    loading.value = false
  }
}

async function onGoogle() {
  googleLoading.value = true
  try {
    await authStore.signInWithGoogle(
      `${window.location.origin}${redirectTarget()}`
    )
  } catch (e) {
    show(errorText(e), true)
    googleLoading.value = false
  }
}

async function onForgotPassword() {
  if (!email.value) {
    show(t('xctAuth.missingEmail'), true)
    return
  }
  try {
    await authStore.sendPasswordReset(email.value, window.location.origin)
    show(t('xctAuth.passwordResetSent'), false)
  } catch (e) {
    show(errorText(e), true)
  }
}
</script>
