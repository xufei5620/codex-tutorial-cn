import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import EmbeddedLayout from '../../../shared/theme/EmbeddedLayout.vue'
import SupportCard from '../../../shared/theme/SupportCard.vue'
import DownloadCards from '../../../shared/theme/DownloadCards.vue'
import './custom.css'
import '../../../shared/theme/course.css'
export default {extends:DefaultTheme,Layout:EmbeddedLayout,enhanceApp({app}){app.component('SupportCard',SupportCard);app.component('DownloadCards',DownloadCards)}} satisfies Theme
