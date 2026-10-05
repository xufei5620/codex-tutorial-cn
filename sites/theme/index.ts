import type { Theme } from 'vitepress'
import StudioLayout from './StudioLayout.vue'
import StudioChapter from './StudioChapter.vue'
import StudioHub from './StudioHub.vue'
import SkillWorkshop from './SkillWorkshop.vue'
import ScreenshotCatalog from './ScreenshotCatalog.vue'
import ScreenshotSlot from './ScreenshotSlot.vue'
import LearningDiagram from './LearningDiagram.vue'
import SupportPanel from './SupportPanel.vue'
import DownloadCards from './DownloadCards.vue'
import DownloadLink from './DownloadLink.vue'
import ManagerAccountNotice from './ManagerAccountNotice.vue'
import './studio.css'
import './clarity.css'
export default {
  Layout: StudioLayout,
  enhanceApp({ app }) {
    for (const [name, component] of Object.entries({
      StudioChapter,
      StudioHub,
      SkillWorkshop,
      ScreenshotCatalog,
      ScreenshotSlot,
      LearningDiagram,
      SupportCard: SupportPanel,
      DownloadCards,
      DownloadLink,
      ManagerAccountNotice
    }))
      app.component(name, component)
  }
} satisfies Theme
