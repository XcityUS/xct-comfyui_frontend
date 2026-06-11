<template>
  <BaseViewTemplate dark>
    <div class="flex size-full max-w-2xl flex-col gap-4 overflow-y-auto p-4">
      <div
        v-if="loadFailed"
        class="border-error-foreground/30 bg-error-foreground/10 flex flex-col items-start gap-2 rounded-lg border p-4"
      >
        <p class="text-error-foreground my-0 font-semibold">
          {{ t('mediaGen.loadFailedTitle') }}
        </p>
        <p class="my-0 text-sm text-muted-foreground">
          {{ t('mediaGen.loadFailedHint') }}
        </p>
        <Button size="sm" variant="secondary" @click="loadModels">
          {{ t('mediaGen.retry') }}
        </Button>
      </div>

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
        <select v-model="selectedModel" :class="inputClass">
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
            'resize-y px-4 py-2',
            inputClass,
            'placeholder:text-muted-foreground'
          )
        "
      />

      <div class="flex items-end gap-2">
        <label
          v-if="mode === 'video'"
          class="flex flex-1 flex-col gap-1 text-sm text-muted-foreground"
        >
          {{ t('mediaGen.duration') }}
          <input v-model="seconds" type="number" min="1" :class="inputClass" />
        </label>
        <label
          v-if="mode === 'image'"
          class="flex flex-1 flex-col gap-1 text-sm text-muted-foreground"
        >
          {{ t('mediaGen.count') }}
          <input
            v-model.number="count"
            type="number"
            min="1"
            :class="inputClass"
          />
        </label>
        <label class="flex flex-1 flex-col gap-1 text-sm text-muted-foreground">
          {{ t('mediaGen.size') }}
          <input
            v-model="size"
            :placeholder="t('mediaGen.sizePlaceholder')"
            :class="inputClass"
          />
        </label>
      </div>

      <Button class="h-10" :disabled="!canSubmit" @click="submit">
        {{ t('mediaGen.generate') }}
      </Button>

      <GenerationGallery
        :jobs="store.jobs"
        @cancel="store.cancel"
        @retry="store.retry"
        @remove="store.remove"
      />
    </div>
  </BaseViewTemplate>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import GenerationGallery from '@/platform/xcity/components/GenerationGallery.vue'
import type { GenerationMode } from '@/platform/xcity/composables/useMediaGeneration'
import { useMediaGeneration } from '@/platform/xcity/composables/useMediaGeneration'
import { useGenerationStore } from '@/platform/xcity/generation/useGenerationStore'
import BaseViewTemplate from '@/views/templates/BaseViewTemplate.vue'

const { t } = useI18n()
const store = useGenerationStore()

const {
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
} = useMediaGeneration()

const inputClass = cn(
  'h-10 w-full rounded-lg border-none bg-secondary-background px-3 text-sm text-base-foreground',
  'focus-visible:ring-1 focus-visible:ring-border-default focus-visible:outline-none'
)

const modes: { value: GenerationMode; label: string }[] = [
  { value: 'video', label: t('mediaGen.modeVideo') },
  { value: 'image', label: t('mediaGen.modeImage') }
]

onMounted(() => {
  document.getElementById('splash-loader')?.remove()
  void loadModels()
})
</script>
