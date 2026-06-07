import { ref } from 'vue'

import {
  LitellmError,
  createVideo,
  fetchVideoContent,
  generateImages,
  listLitellmModels,
  pollVideo
} from '@/platform/xctauth/litellmClient'
import type {
  LitellmImage,
  LitellmModel
} from '@/platform/xctauth/litellmClient'

export type GenerationMode = 'video' | 'image'

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

export function useMediaGeneration() {
  const mode = ref<GenerationMode>('video')
  const prompt = ref('')
  const models = ref<LitellmModel[]>([])
  const selectedModel = ref('')

  const isGenerating = ref(false)
  const progress = ref(0)
  const error = ref('')
  const imageResults = ref<string[]>([])
  const videoUrl = ref<string | null>(null)

  let controller: AbortController | null = null

  function revokeVideo() {
    if (videoUrl.value) {
      URL.revokeObjectURL(videoUrl.value)
      videoUrl.value = null
    }
  }

  async function loadModels() {
    try {
      models.value = await listLitellmModels()
      if (!selectedModel.value && models.value.length) {
        selectedModel.value = models.value[0].id
      }
    } catch (e) {
      error.value = messageOf(e)
    }
  }

  async function runImage(signal: AbortSignal) {
    const images = await generateImages(
      { model: selectedModel.value, prompt: prompt.value },
      signal
    )
    imageResults.value = images
      .map(imageToSrc)
      .filter((src): src is string => src !== null)
  }

  async function runVideo(signal: AbortSignal) {
    const job = await createVideo(
      { model: selectedModel.value, prompt: prompt.value },
      signal
    )
    await pollVideo(job.id, {
      signal,
      onUpdate: (video) => {
        progress.value = video.progress ?? progress.value
      }
    })
    const blob = await fetchVideoContent(job.id, signal)
    videoUrl.value = URL.createObjectURL(blob)
  }

  async function generate() {
    if (!prompt.value.trim() || !selectedModel.value || isGenerating.value) {
      return
    }

    isGenerating.value = true
    error.value = ''
    progress.value = 0
    imageResults.value = []
    revokeVideo()
    controller = new AbortController()

    try {
      if (mode.value === 'image') {
        await runImage(controller.signal)
      } else {
        await runVideo(controller.signal)
      }
    } catch (e) {
      error.value = messageOf(e)
    } finally {
      isGenerating.value = false
      controller = null
    }
  }

  function cancel() {
    controller?.abort()
  }

  return {
    mode,
    prompt,
    models,
    selectedModel,
    isGenerating,
    progress,
    error,
    imageResults,
    videoUrl,
    loadModels,
    generate,
    cancel,
    revokeVideo
  }
}
