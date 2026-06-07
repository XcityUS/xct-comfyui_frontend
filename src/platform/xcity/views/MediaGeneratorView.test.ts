import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MediaGeneratorView from './MediaGeneratorView.vue'

const gen = vi.hoisted(() => ({
  loadModels: vi.fn(),
  generate: vi.fn(),
  cancel: vi.fn(),
  revokeVideo: vi.fn()
}))

vi.mock('@/platform/xcity/composables/useMediaGeneration', async () => {
  const { ref } = await import('vue')
  return {
    useMediaGeneration: () => ({
      mode: ref('video'),
      prompt: ref(''),
      models: ref([]),
      selectedModel: ref(''),
      isGenerating: ref(false),
      progress: ref(0),
      error: ref(''),
      imageResults: ref([]),
      videoUrl: ref(null),
      ...gen
    })
  }
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function renderView() {
  return render(MediaGeneratorView, {
    global: { stubs: { Button: true, BaseViewTemplate: true } }
  })
}

describe('MediaGeneratorView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

    expect(gen.loadModels).toHaveBeenCalledOnce()
  })
})
