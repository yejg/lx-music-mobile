import { memo } from 'react'
import { View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import ButtonPrimary from '@/components/common/ButtonPrimary'
import Text from '@/components/common/Text'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'
import { selectManagedFolder } from '@/utils/fs'
import { resolveSafPath } from '@/utils/safPath'
import { checkAllFilesAccess, tipDialog } from '@/utils/tools'
import RNFS from 'react-native-fs'

const getDefaultDownloadDir = () => {
  return RNFS.DownloadDirectoryPath || (RNFS.ExternalStorageDirectoryPath + '/Download')
}

export default memo(() => {
  const t = useI18n()
  const savePath = useSettingValue('download.savePath')

  const handleSelectPath = () => {
    void selectManagedFolder(true).then(async(dir) => {
      if (!dir?.path) return

      // openDocumentTree 返回的是 SAF content URI，需先还原成真实文件路径，
      // 否则 RNFS 无法写入，下载会一直卡在 0%
      const resolved = await resolveSafPath(dir.path)
      if (!resolved.path) {
        void tipDialog({
          message: t('setting_download_save_path_unsupported', {
            path: dir.path,
            reason: resolved.reason ?? '',
          }),
          btnText: t('ok'),
        })
        return
      }

      updateSetting({ 'download.savePath': resolved.path })
      // 选到 Download 之外的目录（如 Music）时，需要「所有文件访问权限」
      void checkAllFilesAccess()
    }).catch((err) => {
      console.log(err)
    })
  }

  const handleResetPath = () => {
    updateSetting({ 'download.savePath': '' })
  }

  const displayPath = savePath || `${getDefaultDownloadDir()}/lx-music`

  return (
    <SubTitle title={t('setting_download_save_path')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
        <ButtonPrimary onPress={handleSelectPath}>{t('setting_download_save_path_select')}</ButtonPrimary>
        {savePath ? <ButtonPrimary onPress={handleResetPath}>{t('setting_download_save_path_reset')}</ButtonPrimary> : null}
      </View>
      <Text style={{ marginTop: 8 }} size={12}>{t('setting_download_save_path_current', { path: displayPath })}</Text>
    </SubTitle>
  )
})
