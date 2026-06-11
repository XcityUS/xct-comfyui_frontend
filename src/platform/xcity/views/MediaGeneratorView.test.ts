import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MediaGeneratorView from './MediaGeneratorView.vue'

const h = vi.hoisted(() => ({
  loadModels: vi.fn(),
  submit: vi.fn(),
  loadFailed: null as { value: boolean } | null
}))

vi.mock('@/platform/xcity/composables/useMediaGeneration', async () => {
  const { computed, ref } = await import('vue')
  h.loadFailed = ref(false)
  return {
    useMediaGeneration: () => ({
      mode: ref('video'),
      prompt: ref(''),
      models: ref([]),
      selectedModel: ref(''),
      loadFailed: h.loadFailed,
      seconds: ref('5'),
      size: ref(''),
      count: ref(1),
      canSubmit: computed(() => false),
      loadModels: h.loadModels,
      submit: h.submit
    })
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function renderView() {
  return render(MediaGeneratorView, {
    global: {
      plugins: [createPinia()],
      stubs: {
        Button: {
          template: '<button @click="$emit(\'click\')"><slot /></button>'
        },
        BaseViewTemplate: { template: '<div><slot /></div>' },
        GenerationGallery: true
      }
    }
  })
}

describe('MediaGeneratorView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (h.loadFailed) h.loadFailed.value = false
  })

  it('removes the index.html splash loader on mount', () => {
    const splash = document.createElement('div')
    splash.id = 'splash-loader'
    document.body.appendChild(splash)

    renderView()

    expect(splash.isConnected).toBe(false)
  })

  it('loads the available models on mount', () => {
    renderView()

    expect(h.loadModels).toHaveBeenCalledOnce()
  })

  it('shows a clear error banner with a retry action when loading fails', async () => {
    h.loadFailed!.value = true

    renderView()

    expect(screen.getByText('mediaGen.loadFailedTitle')).toBeTruthy()

    h.loadModels.mockClear()
    await userEvent.click(screen.getByText('mediaGen.retry'))
    expect(h.loadModels).toHaveBeenCalled()
  })
})
