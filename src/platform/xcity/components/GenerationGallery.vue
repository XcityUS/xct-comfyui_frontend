<template>
  <div class="flex flex-col gap-3">
    <p
      v-if="!jobs.length"
      class="my-auto text-center text-sm text-muted-foreground"
    >
      {{ t('mediaGen.resultEmpty') }}
    </p>

    <div
      v-for="job in jobs"
      :key="job.id"
      class="flex flex-col gap-2 rounded-lg border border-border-default bg-secondary-background p-3"
    >
      <div class="flex items-center justify-between gap-2 text-sm">
        <span class="truncate text-muted-foreground">{{ job.model }}</span>
        <span
          :class="
            cn(
              'shrink-0 rounded-full px-2 py-0.5 text-xs',
              job.status === 'failed'
                ? 'bg-error-foreground/10 text-error-foreground'
                : 'bg-base-foreground/10 text-muted-foreground'
            )
          "
        >
          {{ statusLabel(job.status) }}
        </span>
      </div>

      <p class="my-0 line-clamp-2 text-sm text-base-foreground">
        {{ job.prompt }}
      </p>

      <div
        v-if="job.status === 'running' && job.kind === 'video'"
        class="h-1.5 w-full overflow-hidden rounded-full bg-base-foreground/10"
      >
        <div
          class="h-full rounded-full bg-azure-600 transition-[width]"
          :style="{ width: `${job.progress}%` }"
        />
      </div>

      <video
        v-if="job.videoUrl"
        :src="job.videoUrl"
        controls
        class="w-full rounded-lg bg-black"
      />

      <div v-else-if="job.images.length" class="grid grid-cols-2 gap-2">
        <img
          v-for="(src, index) in job.images"
          :key="index"
          :src
          class="w-full rounded-lg"
        />
      </div>

      <p
        v-if="job.status === 'failed' && job.error"
        class="text-error-foreground my-0 text-sm"
      >
        {{ job.error }}
      </p>

      <div class="flex items-center gap-2">
        <Button
          v-if="job.status === 'running'"
          size="sm"
          variant="secondary"
          @click="emit('cancel', job.id)"
        >
          {{ t('mediaGen.cancel') }}
        </Button>
        <Button
          v-if="job.status === 'failed' || job.status === 'canceled'"
          size="sm"
          variant="secondary"
          @click="emit('retry', job.id)"
        >
          {{ t('mediaGen.retry') }}
        </Button>
        <a
          v-if="downloadHref(job)"
          :href="downloadHref(job)!"
          :download="`${job.id}.${job.kind === 'video' ? 'mp4' : 'png'}`"
          :class="
            cn(
              'rounded-lg px-3 py-1 text-sm text-muted-foreground',
              'hover:text-base-foreground'
            )
          "
        >
          {{ t('mediaGen.download') }}
        </a>
        <Button
          size="sm"
          variant="secondary"
          class="ml-auto"
          @click="emit('remove', job.id)"
        >
          {{ t('mediaGen.delete') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type { GenerationJob } from '@/platform/xcity/generation/useGenerationStore'

const { jobs } = defineProps<{ jobs: GenerationJob[] }>()
const emit = defineEmits<{
  cancel: [id: string]
  retry: [id: string]
  remove: [id: string]
}>()

const { t } = useI18n()

function statusLabel(status: GenerationJob['status']): string {
  switch (status) {
    case 'queued':
      return t('mediaGen.status.queued')
    case 'running':
      return t('mediaGen.status.running')
    case 'completed':
      return t('mediaGen.status.completed')
    case 'failed':
      return t('mediaGen.status.failed')
    case 'canceled':
      return t('mediaGen.status.canceled')
  }
}

function downloadHref(job: GenerationJob): string | null {
  return job.videoUrl ?? job.images[0] ?? null
}
</script>
