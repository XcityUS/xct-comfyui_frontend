import { computed, ref } from 'vue'

import { useGenerationStore } from '@/platform/xcity/generation/useGenerationStore'
import type { GenerationKind } from '@/platform/xcity/generation/useGenerationStore'
import { getAvailableModels } from '@/platform/xcity/litellmClient'

export type GenerationMode = GenerationKind

export function useMediaGeneration() {
  const store = useGenerationStore()

  const mode = ref<GenerationMode>('video')
  const prompt = ref('')
  const models = ref<string[]>([])
  const selectedModel = ref('')
  const loadFailed = ref(false)

  const seconds = ref('5')
  const size = ref('')
  const count = ref(1)

  async function loadModels() {
    loadFailed.value = false
    try {
      models.value = await getAvailableModels()
      if (!selectedModel.value && models.value.length) {
        selectedModel.value = models.value[0]
      }
    } catch {
      loadFailed.value = true
    }
  }

  const canSubmit = computed(
    () => !!prompt.value.trim() && !!selectedModel.value
  )

  function submit() {
    if (!canSubmit.value) return
    store.submit({
      kind: mode.value,
      model: selectedModel.value,
      prompt: prompt.value,
      params: {
        seconds: mode.value === 'video' ? seconds.value : undefined,
        size: size.value || undefined,
        n: mode.value === 'image' ? count.value : undefined
      }
    })
  }

  return {
    mode,
    prompt,
    models,
    selectedModel,
    loadFailed,
    seconds,
    size,
    count,
    canSubmit,
    loadModels,
    submit
  }
}
