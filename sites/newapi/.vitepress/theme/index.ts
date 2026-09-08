import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme-without-fonts'
import EmbeddedLayout from '../../../shared/theme/EmbeddedLayout.vue'
import SupportCard from '../../../shared/theme/SupportCard.vue'
import DownloadCards from '../../../shared/theme/DownloadCards.vue'
import './custom.css'
import '../../../shared/theme/course.css'
import '../../../shared/theme/system-fonts.css'
export default {extends:DefaultTheme,Layout:EmbeddedLayout,enhanceApp({app}){app.component('SupportCard',SupportCard);app.component('DownloadCards',DownloadCards)}} satisfies Theme
