import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useMediaGeneration } from './useMediaGeneration'

const client = vi.hoisted(() => ({
  listLitellmModels: vi.fn(),
  generateImages: vi.fn(),
  createVideo: vi.fn(),
  pollVideo: vi.fn(),
  fetchVideoContent: vi.fn()
}))

vi.mock('@/platform/xctauth/litellmClient', async (importOriginal) => ({
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

  it('loads models and defaults the selection to the first model', async () => {
    client.listLitellmModels.mockResolvedValue([
      { id: 'seedance-2.0' },
      { id: 'flux' }
    ])
    const gen = useMediaGeneration()

    await gen.loadModels()

    expect(gen.models.value).toHaveLength(2)
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
    expect(gen.isGenerating.value).toBe(false)
  })

  it('runs the video pipeline: create, poll, fetch content', async () => {
    client.createVideo.mockResolvedValue({ id: 'vid_9', status: 'queued' })
    client.pollVideo.mockImplementation(async (_id, opts) => {
      opts?.onUpdate?.({ id: 'vid_9', status: 'completed', progress: 100 })
      return { id: 'vid_9', status: 'completed' }
    })
    client.fetchVideoContent.mockResolvedValue(new Blob(['x']))
    const gen = useMediaGeneration()
    gen.mode.value = 'video'
    gen.selectedModel.value = 'seedance-2.0'
    gen.prompt.value = 'a wave'

    await gen.generate()

    expect(client.createVideo).toHaveBeenCalledWith(
      { model: 'seedance-2.0', prompt: 'a wave' },
      expect.any(AbortSignal)
    )
    expect(gen.progress.value).toBe(100)
    expect(gen.videoUrl.value).toBe('blob:fake')
  })

  it('surfaces an error message when generation fails', async () => {
    client.generateImages.mockRejectedValue(new Error('content blocked'))
    const gen = useMediaGeneration()
    gen.mode.value = 'image'
    gen.selectedModel.value = 'flux'
    gen.prompt.value = 'x'

    await gen.generate()

    expect(gen.error.value).toBe('content blocked')
    expect(gen.isGenerating.value).toBe(false)
  })

  it('does nothing when the prompt is empty', async () => {
    const gen = useMediaGeneration()
    gen.selectedModel.value = 'flux'
    gen.prompt.value = '   '

    await gen.generate()

    expect(client.generateImages).not.toHaveBeenCalled()
    expect(client.createVideo).not.toHaveBeenCalled()
  })
})
