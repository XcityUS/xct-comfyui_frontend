import { markRaw } from 'vue'

import MediaGeneratorView from '@/platform/xctauth/views/MediaGeneratorView.vue'
import type { SidebarTabExtension } from '@/types/extensionTypes'

export function useMediaGeneratorSidebarTab(): SidebarTabExtension {
  return {
    id: 'media-generator',
    icon: 'icon-[lucide--sparkles]',
    title: 'mediaGen.title',
    tooltip: 'mediaGen.title',
    label: 'mediaGen.title',
    component: markRaw(MediaGeneratorView),
    type: 'vue'
  }
}
