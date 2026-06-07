<template>
  <BaseViewTemplate dark>
    <div class="flex size-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">
      <div class="flex items-center gap-2">
        <Button
          v-for="option in modes"
          :key="option.value"
          size="sm"
          :variant="mode === option.value ? 'base' : 'secondary'"
          @click="mode = option.value"
        >
          {{ option.label }}
        </Button>
      </div>

      <label class="flex flex-col gap-1 text-sm text-muted-foreground">
        {{ t('mediaGen.model') }}
        <select
          v-model="selectedModel"
          :class="
            cn(
              'h-10 w-full rounded-lg border-none bg-secondary-background px-3 text-sm text-base-foreground',
              'focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none'
            )
          "
        >
          <option v-if="!models.length" value="" disabled>
            {{ t('mediaGen.noModels') }}
          </option>
          <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
        </select>
      </label>

      <textarea
        v-model="prompt"
        rows="3"
        :placeholder="t('mediaGen.promptPlaceholder')"
        :class="
          cn(
            'w-full resize-y rounded-lg border-none bg-secondary-background px-4 py-2 text-sm text-base-foreground',
            'placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none'
          )
        "
      />

      <div class="flex items-center gap-2">
        <Button
          class="h-10 flex-1"
          :loading="isGenerating"
          :disabled="!canGenerate"
          @click="generate"
        >
          {{ isGenerating ? t('mediaGen.generating') : t('mediaGen.generate') }}
        </Button>
        <Button
          v-if="isGenerating"
          variant="secondary"
          class="h-10"
          @click="cancel"
        >
          {{ t('mediaGen.cancel') }}
        </Button>
      </div>

      <div
        v-if="isGenerating && mode === 'video'"
        class="h-1.5 w-full overflow-hidden rounded-full bg-secondary-background"
      >
        <div
          class="h-full rounded-full bg-azure-600 transition-[width]"
          :style="{ width: `${progress}%` }"
        />
      </div>

      <p v-if="error" class="text-error-foreground my-0 text-sm">{{ error }}</p>

      <div class="flex flex-1 flex-col gap-3">
        <video
          v-if="videoUrl"
          :src="videoUrl"
          controls
          class="w-full rounded-lg bg-black"
        />

        <div v-else-if="imageResults.length" class="grid grid-cols-2 gap-3">
          <img
            v-for="(src, index) in imageResults"
            :key="index"
            :src
            class="w-full rounded-lg"
          />
        </div>

        <p v-else class="my-auto text-center text-sm text-muted-foreground">
          {{ t('mediaGen.resultEmpty') }}
        </p>
      </div>
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { GenerationMode } from '@/platform/xcity/composables/useMediaGeneration'
import { useMediaGeneration } from '@/platform/xcity/composables/useMediaGeneration'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const { t } = useI18n()

const {
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
} = useMediaGeneration()

const modes: { value: GenerationMode; label: string }[] = [
  { value: 'video', label: t('mediaGen.modeVideo') },
  { value: 'image', label: t('mediaGen.modeImage') }
]

const canGenerate = computed(
  () => !!prompt.value.trim() && !!selectedModel.value && !isGenerating.value
)

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
  void loadModels()
})
onUnmounted(revokeVideo)
</script>
