import { memo } from 'react'

import Section from '../../components/Section'
import SavePath from './SavePath'
import IsDownloadLyric from './IsDownloadLyric'
import MaxConcurrent from './MaxConcurrent'

import { useI18n } from '@/lang'

export default memo(() => {
  const t = useI18n()

  return (
    <Section title={t('setting_download')}>
      <SavePath />
      <IsDownloadLyric />
      <MaxConcurrent />
    </Section>
  )
})
