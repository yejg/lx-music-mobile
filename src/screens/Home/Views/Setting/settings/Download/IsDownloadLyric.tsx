import { memo } from 'react'
import CheckBoxItem from '../../components/CheckBoxItem'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

export default memo(() => {
  const t = useI18n()
  const isDownloadLyric = useSettingValue('download.isDownloadLyric')

  return (
    <CheckBoxItem
      check={isDownloadLyric}
      onChange={(check) => { updateSetting({ 'download.isDownloadLyric': check }) }}
      label={t('setting_download_is_download_lyric')}
    />
  )
})
