import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaGeneration } from './useMediaGeneration'

const client = vi.hoisted(() => ({
  getAvailableModels: vi.fn(),
  generateImages: vi.fn(),
  createVideo: vi.fn(),
  pollVideo: vi.fn(),
  fetchVideoContent: vi.fn()
}))

vi.mock('@/platform/xcity/litellmClient', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...client
}))

describe('useMediaGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:fake'),
      revokeObjectURL: vi.fn()
    })
  })

  it('loads the allowed models and defaults the selection', async () => {
    client.getAvailableModels.mockResolvedValue(['seedance-2.0', 'flux'])
    const gen = useMediaGeneration()

    await gen.loadModels()

    expect(gen.models.value).toEqual(['seedance-2.0', 'flux'])
    expect(gen.selectedModel.value).toBe('seedance-2.0')
  })

  it('generates images and collects their sources', async () => {
    client.generateImages.mockResolvedValue([
      { url: 'https://cdn/a.png' },
      { b64_json: 'AAAA' }
    ])
    const gen = useMediaGeneration()
    gen.mode.value = 'image'
    gen.selectedModel.value = 'flux'
    gen.prompt.value = 'a fox'

    await gen.generate()

    expect(gen.imageResults.value).toEqual([
      'https://cdn/a.png',
      'data:image/png;base64,AAAA'
    ])
  })

  it('runs the video pipeline and exposes an object URL', async () => {
    client.createVideo.mockResolvedValue({ id: 'v9', status: 'queued' })
    client.pollVideo.mockImplementation(async (_id, opts) => {
      opts?.onUpdate?.({ id: 'v9', status: 'completed', progress: 100 })
      return { id: 'v9', status: 'completed' }
    })
    client.fetchVideoContent.mockResolvedValue(new Blob(['x']))
    const gen = useMediaGeneration()
    gen.mode.value = 'video'
    gen.selectedModel.value = 'seedance-2.0'
    gen.prompt.value = 'a wave'

    await gen.generate()

    expect(gen.progress.value).toBe(100)
    expect(gen.videoUrl.value).toBe('blob:fake')
  })

  it('surfaces an error and does nothing on empty prompt', async () => {
    client.generateImages.mockRejectedValue(new Error('blocked'))
    const gen = useMediaGeneration()
    gen.mode.value = 'image'
    gen.selectedModel.value = 'flux'

    gen.prompt.value = '  '
    await gen.generate()
    expect(client.generateImages).not.toHaveBeenCalled()

    gen.prompt.value = 'x'
    await gen.generate()
    expect(gen.error.value).toBe('blocked')
  })
})
