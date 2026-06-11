import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({ getAvailableModels: vi.fn() }))

vi.mock('@/platform/xcity/litellmClient', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...client
}))

import { useGenerationStore } from '@/platform/xcity/generation/useGenerationStore'
import { useMediaGeneration } from './useMediaGeneration'

describe('useMediaGeneration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('loads the allowed models and defaults the selection', async () => {
    client.getAvailableModels.mockResolvedValue(['seedance', 'seedream'])
    const gen = useMediaGeneration()

    await gen.loadModels()

    expect(gen.models.value).toEqual(['seedance', 'seedream'])
    expect(gen.selectedModel.value).toBe('seedance')
    expect(gen.loadFailed.value).toBe(false)
  })

  it('flags loadFailed when the models cannot be fetched', async () => {
    client.getAvailableModels.mockRejectedValue(new Error('down'))
    const gen = useMediaGeneration()

    await gen.loadModels()

    expect(gen.loadFailed.value).toBe(true)
  })

  it('submits a video job with the chosen duration to the store', () => {
    const store = useGenerationStore()
    const spy = vi.spyOn(store, 'submit').mockReturnValue('job-1')
    const gen = useMediaGeneration()
    gen.mode.value = 'video'
    gen.selectedModel.value = 'seedance'
    gen.prompt.value = 'a fox'
    gen.seconds.value = '8'

    gen.submit()

    expect(spy).toHaveBeenCalledWith({
      kind: 'video',
      model: 'seedance',
      prompt: 'a fox',
      params: { seconds: '8', size: undefined, n: undefined }
    })
  })

  it('does not submit without a prompt or model', () => {
    const store = useGenerationStore()
    const spy = vi.spyOn(store, 'submit')
    const gen = useMediaGeneration()

    gen.submit()

    expect(spy).not.toHaveBeenCalled()
    expect(gen.canSubmit.value).toBe(false)
  })
})
