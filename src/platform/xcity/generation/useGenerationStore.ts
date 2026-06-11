import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import {
  LitellmError,
  createVideo,
  fetchVideoContent,
  generateImages,
  pollVideo
} from '@/platform/xcity/litellmClient'
import type { LitellmImage } from '@/platform/xcity/litellmClient'

export type GenerationKind = 'image' | 'video'

type GenerationStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'canceled'

interface GenerationParams {
  seconds?: string
  size?: string
  n?: number
}

export interface GenerationJob {
  id: string
  kind: GenerationKind
  model: string
  prompt: string
  params: GenerationParams
  status: GenerationStatus
  progress: number
  images: string[]
  videoUrl: string | null
  error: string | null
  createdAt: number
}

interface GenerationInput {
  kind: GenerationKind
  model: string
  prompt: string
  params?: GenerationParams
}

function imageToSrc(image: LitellmImage): string | null {
  if (image.url) return image.url
  if (image.b64_json) return `data:image/png;base64,${image.b64_json}`
  return null
}

function messageOf(error: unknown): string {
  if (error instanceof LitellmError || error instanceof Error) {
    return error.message
  }
  return 'Generation failed'
}

let sequence = 0

export const useGenerationStore = defineStore('xcityGeneration', () => {
  const jobs = ref<GenerationJob[]>([])
  const controllers = new Map<string, AbortController>()

  function nextId(): string {
    sequence += 1
    return `job-${Date.now()}-${sequence}`
  }

  async function runImage(job: GenerationJob, signal: AbortSignal) {
    const images = await generateImages(
      {
        model: job.model,
        prompt: job.prompt,
        size: job.params.size,
        n: job.params.n
      },
      signal
    )
    job.images = images
      .map(imageToSrc)
      .filter((src): src is string => src !== null)
  }

  async function runVideo(job: GenerationJob, signal: AbortSignal) {
    const created = await createVideo(
      {
        model: job.model,
        prompt: job.prompt,
        seconds: job.params.seconds,
        size: job.params.size
      },
      signal
    )
    await pollVideo(created.id, {
      signal,
      onUpdate: (video) => {
        job.progress = video.progress ?? job.progress
      }
    })
    const blob = await fetchVideoContent(created.id, signal)
    job.videoUrl = URL.createObjectURL(blob)
  }

  async function run(job: GenerationJob) {
    const controller = new AbortController()
    controllers.set(job.id, controller)
    job.status = 'running'
    job.error = null
    try {
      if (job.kind === 'image') {
        await runImage(job, controller.signal)
      } else {
        await runVideo(job, controller.signal)
      }
      job.status = 'completed'
    } catch (e) {
      job.status = controller.signal.aborted ? 'canceled' : 'failed'
      if (job.status === 'failed') job.error = messageOf(e)
    } finally {
      controllers.delete(job.id)
    }
  }

  function submit(input: GenerationInput): string {
    const job = reactive<GenerationJob>({
      id: nextId(),
      kind: input.kind,
      model: input.model,
      prompt: input.prompt,
      params: input.params ?? {},
      status: 'queued',
      progress: 0,
      images: [],
      videoUrl: null,
      error: null,
      createdAt: Date.now()
    })
    jobs.value.unshift(job)
    void run(job)
    return job.id
  }

  function cancel(id: string) {
    controllers.get(id)?.abort()
  }

  function retry(id: string) {
    const job = jobs.value.find((j) => j.id === id)
    if (!job) return
    if (job.videoUrl) URL.revokeObjectURL(job.videoUrl)
    job.progress = 0
    job.images = []
    job.videoUrl = null
    void run(job)
  }

  function remove(id: string) {
    cancel(id)
    const job = jobs.value.find((j) => j.id === id)
    if (job?.videoUrl) URL.revokeObjectURL(job.videoUrl)
    jobs.value = jobs.value.filter((j) => j.id !== id)
  }

  return { jobs, submit, cancel, retry, remove }
})
