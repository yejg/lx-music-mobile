import { memo, useState, useCallback, useEffect } from 'react'
import { View } from 'react-native'

import Header from './components/Header'
import List from './components/List'
import PageContent from '@/components/PageContent'
import { createStyle, confirmDialog } from '@/utils/tools'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { clearCompletedTasks, getDownloadTaskList } from '@/core/download/manager'
import { addTempPlayList } from '@/core/player/tempPlayList'

export default memo(({ componentId }: {
  componentId: string
}) => {
  const [activeTab, setActiveTab] = useState<'downloading' | 'completed'>('downloading')

  useEffect(() => {
    setComponentId(COMPONENT_IDS.download, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChangeTab = useCallback((tab: 'downloading' | 'completed') => {
    setActiveTab(tab)
  }, [])

  const handleClear = useCallback(() => {
    void confirmDialog({
      message: global.i18n.t('download_clear_completed_tip'),
      confirmButtonText: global.i18n.t('confirm_button_text'),
    }).then(isClear => {
      if (!isClear) return
      clearCompletedTasks()
    })
  }, [])

  const handlePlay = useCallback(async(task: LX.Download.ListItem) => {
    const list = await getDownloadTaskList()
    const completedList = list.filter(t => t.status == 'completed')

    // 将已下载的歌曲作为临时播放列表播放
    addTempPlayList(completedList.map(musicInfo => ({ listId: null, musicInfo })))
  }, [])

  return (
    <PageContent>
      <View style={styles.container}>
        <Header activeTab={activeTab} onChangeTab={handleChangeTab} onClear={handleClear} />
        <List type={activeTab} onPlay={handlePlay} />
      </View>
    </PageContent>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
  },
})
