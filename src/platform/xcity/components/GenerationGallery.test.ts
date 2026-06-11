import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import GenerationGallery from './GenerationGallery.vue'
import type { GenerationJob } from '@/platform/xcity/generation/useGenerationStore'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

function makeJob(over: Partial<GenerationJob>): GenerationJob {
  return {
    id: 'j1',
    kind: 'image',
    model: 'm',
    prompt: 'p',
    params: {},
    status: 'completed',
    progress: 0,
    images: [],
    videoUrl: null,
    error: null,
    createdAt: 0,
    ...over
  }
}

const stubs = {
  Button: { template: '<button @click="$emit(\'click\')"><slot /></button>' }
}

describe('GenerationGallery', () => {
  it('shows the empty state when there are no jobs', () => {
    render(GenerationGallery, { props: { jobs: [] }, global: { stubs } })

    expect(screen.getByText('mediaGen.resultEmpty')).toBeTruthy()
  })

  it('shows the error and emits retry for a failed job', async () => {
    const { emitted } = render(GenerationGallery, {
      props: { jobs: [makeJob({ status: 'failed', error: 'boom' })] },
      global: { stubs }
    })

    expect(screen.getByText('boom')).toBeTruthy()
    await userEvent.click(screen.getByText('mediaGen.retry'))
    expect(emitted().retry[0]).toEqual(['j1'])
  })

  it('emits remove when delete is clicked', async () => {
    const { emitted } = render(GenerationGallery, {
      props: { jobs: [makeJob({})] },
      global: { stubs }
    })

    await userEvent.click(screen.getByText('mediaGen.delete'))
    expect(emitted().remove[0]).toEqual(['j1'])
  })

  it('emits cancel for a running job', async () => {
    const { emitted } = render(GenerationGallery, {
      props: { jobs: [makeJob({ status: 'running', kind: 'video' })] },
      global: { stubs }
    })

    await userEvent.click(screen.getByText('mediaGen.cancel'))
    expect(emitted().cancel[0]).toEqual(['j1'])
  })
})
