import { memo, useCallback } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import Text from '@/components/common/Text'
import { scaleSizeH } from '@/utils/pixelRatio'
import { BorderWidths } from '@/theme'

const ITEM_HEIGHT = scaleSizeH(72)

const ProgressBar = memo(({ progress, theme }: { progress: number, theme: any }) => {
  return (
    <View style={{ ...styles.progressBg, backgroundColor: theme['c-primary-light-100-alpha-100'] }}>
      <View style={{ ...styles.progressFill, width: `${Math.min(100, Math.max(0, progress))}%`, backgroundColor: theme['c-primary'] }} />
    </View>
  )
})

export default memo(({ task, onPause, onResume, onRetry, onRemove }: {
  task: LX.Download.ListItem
  onPause: (id: string) => void
  onResume: (id: string) => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}) => {
  const theme = useTheme()

  const handlePress = useCallback(() => {
    switch (task.status) {
      case 'run':
      case 'waiting':
        onPause(task.id)
        break
      case 'pause':
      case 'error':
        onResume(task.id)
        break
      default:
        break
    }
  }, [onPause, onResume, task.id, task.status])

  const iconName = task.status == 'run' || task.status == 'waiting'
    ? 'pause'
    : 'play'

  const statusText = task.statusText || task.status

  const formatSize = (bytes: number) => {
    if (bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`
  }

  const sizeText = task.total > 0
    ? `${formatSize(task.downloaded)} / ${formatSize(task.total)}`
    : task.downloaded > 0
      ? formatSize(task.downloaded)
      : ''

  const handleRemove = useCallback(() => {
    onRemove(task.id)
  }, [onRemove, task.id])

  const handleRetry = useCallback(() => {
    onRetry(task.id)
  }, [onRetry, task.id])

  return (
    <TouchableOpacity
      style={{ ...styles.container, borderBottomColor: theme['c-border-background'] }}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.info}>
        <Text numberOfLines={1} size={15}>{task.metadata.musicInfo.name}</Text>
        <Text numberOfLines={1} size={12} color={theme['c-font-label']} style={styles.subText}>
          {`${task.metadata.musicInfo.singer} · ${task.metadata.quality}`}
        </Text>
        <View style={styles.progressRow}>
          <ProgressBar progress={task.progress} theme={theme} />
          <Text size={11} color={theme['c-font-label']} style={styles.progressText}>{`${task.progress}%`}</Text>
        </View>
        <Text numberOfLines={1} size={11} color={theme['c-font-label']} style={styles.statusText}>
          {`${statusText}${task.speed ? ` · ${task.speed}` : ''}${sizeText ? ` · ${sizeText}` : ''}`}
        </Text>
      </View>
      <View style={styles.actions}>
        {
          task.status == 'error'
            ? (
              <TouchableOpacity onPress={handleRetry} style={styles.actionBtn}>
                <Icon name="play" size={20} color={theme['c-primary']} />
              </TouchableOpacity>
              )
            : (
              <TouchableOpacity onPress={handlePress} style={styles.actionBtn}>
                <Icon name={iconName} size={20} color={theme['c-primary']} />
              </TouchableOpacity>
              )
        }
        <TouchableOpacity onPress={handleRemove} style={styles.actionBtn}>
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
    paddingTop: 8,
    paddingBottom: 8,
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  progressText: {
    width: 42,
    textAlign: 'right',
  },
  statusText: {
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
