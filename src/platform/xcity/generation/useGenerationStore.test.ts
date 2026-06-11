import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const client = vi.hoisted(() => ({
  generateImages: vi.fn(),
  createVideo: vi.fn(),
  pollVideo: vi.fn(),
  fetchVideoContent: vi.fn()
}))

vi.mock('@/platform/xcity/litellmClient', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...client
}))

import { useGenerationStore } from './useGenerationStore'

describe('useGenerationStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:video'),
      revokeObjectURL: vi.fn()
    })
  })

  it('runs an image job to completion and stores the results', async () => {
    client.generateImages.mockResolvedValue([{ url: 'https://img/1.png' }])
    const store = useGenerationStore()

    store.submit({ kind: 'image', model: 'seedream', prompt: 'a cat' })
    const job = store.jobs[0]

    expect(job.kind).toBe('image')
    await vi.waitFor(() => expect(job.status).toBe('completed'))
    expect(job.images).toEqual(['https://img/1.png'])
    expect(client.generateImages).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'seedream', prompt: 'a cat' }),
      expect.any(AbortSignal)
    )
  })

  it('runs a video job through create → poll → content', async () => {
    client.createVideo.mockResolvedValue({ id: 'vid-1', status: 'queued' })
    client.pollVideo.mockResolvedValue({ id: 'vid-1', status: 'completed' })
    client.fetchVideoContent.mockResolvedValue(new Blob())
    const store = useGenerationStore()

    store.submit({ kind: 'video', model: 'seedance', prompt: 'a fox' })
    const job = store.jobs[0]

    await vi.waitFor(() => expect(job.status).toBe('completed'))
    expect(job.videoUrl).toBe('blob:video')
    expect(client.fetchVideoContent).toHaveBeenCalledWith(
      'vid-1',
      expect.any(AbortSignal)
    )
  })

  it('marks a job failed with the error message when generation throws', async () => {
    client.generateImages.mockRejectedValue(new Error('boom'))
    const store = useGenerationStore()

    store.submit({ kind: 'image', model: 'm', prompt: 'p' })
    const job = store.jobs[0]

    await vi.waitFor(() => expect(job.status).toBe('failed'))
    expect(job.error).toBe('boom')
  })

  it('cancels an in-flight job', async () => {
    client.createVideo.mockResolvedValue({ id: 'v', status: 'queued' })
    client.pollVideo.mockImplementation(
      (_id: string, { signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    const store = useGenerationStore()

    const id = store.submit({ kind: 'video', model: 'm', prompt: 'p' })
    const job = store.jobs[0]
    await vi.waitFor(() => expect(job.status).toBe('running'))

    store.cancel(id)
    await vi.waitFor(() => expect(job.status).toBe('canceled'))
  })

  it('retries a failed job', async () => {
    client.generateImages.mockRejectedValueOnce(new Error('boom'))
    client.generateImages.mockResolvedValueOnce([{ url: 'https://img/ok.png' }])
    const store = useGenerationStore()

    const id = store.submit({ kind: 'image', model: 'm', prompt: 'p' })
    const job = store.jobs[0]
    await vi.waitFor(() => expect(job.status).toBe('failed'))

    store.retry(id)
    await vi.waitFor(() => expect(job.status).toBe('completed'))
    expect(job.images).toEqual(['https://img/ok.png'])
  })

  it('removes a job and revokes its video url', async () => {
    client.createVideo.mockResolvedValue({ id: 'v', status: 'queued' })
    client.pollVideo.mockResolvedValue({ id: 'v', status: 'completed' })
    client.fetchVideoContent.mockResolvedValue(new Blob())
    const store = useGenerationStore()

    const id = store.submit({ kind: 'video', model: 'm', prompt: 'p' })
    await vi.waitFor(() => expect(store.jobs[0].status).toBe('completed'))

    store.remove(id)
    expect(store.jobs).toHaveLength(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:video')
  })
})
