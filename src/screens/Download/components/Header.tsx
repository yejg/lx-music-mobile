import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'

import { Icon } from '@/components/common/Icon'
import { pop } from '@/navigation'
import StatusBar from '@/components/common/StatusBar'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { HEADER_HEIGHT as _HEADER_HEIGHT } from '@/config/constant'
import { scaleSizeH } from '@/utils/pixelRatio'
import commonState from '@/store/common/state'
import { useStatusbarHeight } from '@/store/common/hook'
import { useTheme } from '@/store/theme/hook'

const HEADER_HEIGHT = scaleSizeH(_HEADER_HEIGHT)

export default memo(({ activeTab, onChangeTab, onClear }: {
  activeTab: 'downloading' | 'completed'
  onChangeTab: (tab: 'downloading' | 'completed') => void
  onClear: () => void
}) => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const theme = useTheme()

  const back = () => {
    void pop(commonState.componentIds.download!)
  }

  return (
    <View style={{ height: HEADER_HEIGHT + statusBarHeight, paddingTop: statusBarHeight }}>
      <StatusBar />
      <View style={{ ...styles.container }}>
        <TouchableOpacity onPress={back} style={{ ...styles.button, width: HEADER_HEIGHT }}>
          <Icon name="chevron-left" size={18} />
        </TouchableOpacity>
        <View style={styles.tabs}>
          <TouchableOpacity onPress={() => { onChangeTab('downloading') }} style={styles.tabBtn}>
            <Text color={activeTab == 'downloading' ? theme['c-primary-font-active'] : undefined}>{t('download_tab_downloading')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { onChangeTab('completed') }} style={styles.tabBtn}>
            <Text color={activeTab == 'completed' ? theme['c-primary-font-active'] : undefined}>{t('download_tab_completed')}</Text>
          </TouchableOpacity>
        </View>
        {
          activeTab == 'completed'
            ? (
              <TouchableOpacity onPress={onClear} style={{ ...styles.button, width: HEADER_HEIGHT }}>
                <Icon name="eraser" size={18} />
              </TouchableOpacity>
              )
            : <View style={{ ...styles.button, width: HEADER_HEIGHT }} />
        }
      </View>
    </View>
  )
})


const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    // paddingRight: 40,
    // backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  button: {
    // paddingLeft: 10,
    // paddingRight: 10,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBtn: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  icon: {
    paddingLeft: 4,
    paddingRight: 4,
  },
})
