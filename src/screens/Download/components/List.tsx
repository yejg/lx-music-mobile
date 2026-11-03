import { memo, useCallback, useEffect, useState, useMemo } from 'react'
import { FlatList, View } from 'react-native'

import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import DownloadingItem from './DownloadingItem'
import CompletedItem from './CompletedItem'
import {
  getDownloadTaskList,
  pauseDownloadTask,
  resumeDownloadTask,
  retryDownloadTask,
  removeDownloadTask,
} from '@/core/download/manager'

const Empty = memo(({ text }: { text: string }) => {
  const theme = useTheme()
  return (
    <View style={styles.empty}>
      <Text color={theme['c-font-label']}>{text}</Text>
    </View>
  )
})

export default memo(({ type, onPlay }: {
  type: 'downloading' | 'completed'
  onPlay: (task: LX.Download.ListItem) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const [tasks, setTasks] = useState<LX.Download.ListItem[]>([])

  const refresh = useCallback(async() => {
    const list = await getDownloadTaskList()
    setTasks(list)
  }, [])

  useEffect(() => {
    void refresh()
    const handleUpdate = () => {
      void refresh()
    }
    global.app_event.on('downloadListUpdate', handleUpdate)
    return () => {
      global.app_event.off('downloadListUpdate', handleUpdate)
    }
  }, [refresh])

  const filteredTasks = useMemo(() => {
    if (type == 'downloading') {
      return tasks.filter(t => t.status != 'completed')
    }
    return tasks.filter(t => t.status == 'completed')
  }, [tasks, type])

  const handlePause = useCallback((id: string) => {
    pauseDownloadTask(id)
  }, [])

  const handleResume = useCallback((id: string) => {
    void resumeDownloadTask(id)
  }, [])

  const handleRetry = useCallback((id: string) => {
    retryDownloadTask(id)
  }, [])

  const handleRemove = useCallback((id: string) => {
    void removeDownloadTask(id)
  }, [])

  const renderItem = useCallback(({ item }: { item: LX.Download.ListItem }) => {
    return type == 'downloading'
      ? (
          <DownloadingItem
            task={item}
            onPause={handlePause}
            onResume={handleResume}
            onRetry={handleRetry}
            onRemove={handleRemove}
          />
        )
      : <CompletedItem task={item} onPlay={onPlay} />
  }, [type, handlePause, handleResume, handleRetry, handleRemove, onPlay])

  const keyExtractor = useCallback((item: LX.Download.ListItem) => item.id, [])

  const emptyText = type == 'downloading' ? t('download_empty_downloading') : t('download_empty_completed')

  return (
    <FlatList
      style={{ ...styles.list, backgroundColor: theme['c-content-background'] }}
      data={filteredTasks}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      ListEmptyComponent={<Empty text={emptyText} />}
    />
  )
})

const styles = createStyle({
  list: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
})
