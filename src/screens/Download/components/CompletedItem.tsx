import { memo, useCallback, useEffect, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { createStyle, confirmDialog } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { BorderWidths } from '@/theme'
import { getDownloadedFileSize, removeDownloadTask } from '@/core/download/manager'
import { addTempPlayList } from '@/core/player/tempPlayList'

const ITEM_HEIGHT = scaleSizeH(64)

const formatSize = (bytes: number) => {
  if (bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`
}

export default memo(({ task, onPlay }: {
  task: LX.Download.ListItem
  onPlay: (task: LX.Download.ListItem) => void
}) => {
  const theme = useTheme()
  const [fileSize, setFileSize] = useState(0)

  useEffect(() => {
    void getDownloadedFileSize(task.metadata.filePath).then(setFileSize)
  }, [task.metadata.filePath])

  const handlePlay = useCallback(() => {
    onPlay(task)
  }, [onPlay, task])

  const handleDelete = useCallback(() => {
    void confirmDialog({
      message: global.i18n.t('download_delete_file_confirm', { name: task.metadata.musicInfo.name }),
      confirmButtonText: global.i18n.t('confirm_button_text'),
    }).then(isDelete => {
      if (!isDelete) return
      void removeDownloadTask(task.id, true)
    })
  }, [task.id, task.metadata.musicInfo.name])

  const handlePlayLater = useCallback(() => {
    addTempPlayList([{ listId: null, musicInfo: task }])
  }, [task])

  return (
    <TouchableOpacity
      style={{ ...styles.container, borderBottomColor: theme['c-border-background'] }}
      onPress={handlePlay}
      activeOpacity={0.7}
    >
      <View style={styles.info}>
        <Text numberOfLines={1} size={15}>{task.metadata.musicInfo.name}</Text>
        <Text numberOfLines={1} size={12} color={theme['c-font-label']} style={styles.subText}>
          {`${task.metadata.musicInfo.singer} · ${task.metadata.ext.toUpperCase()}${fileSize ? ` · ${formatSize(fileSize)}` : ''}`}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={handlePlayLater} style={styles.actionBtn}>
          <Icon name="add-music" size={18} color={theme['c-font-label']} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete} style={styles.actionBtn}>
          <Icon name="close" size={18} color={theme['c-font-label']} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 10,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: BorderWidths.normal,
    minHeight: ITEM_HEIGHT,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  subText: {
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
