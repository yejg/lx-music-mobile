import { View } from 'react-native'
import Aside from './Aside'
import PlayerBar from '@/components/player/PlayerBar'
import StatusBar from '@/components/common/StatusBar'
import Header from './Header'
import Main from './Main'
import { createStyle } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
})

export default () => {
  const drawerLayoutPosition = useSettingValue('common.drawerLayoutPosition')
  const isNavOnRight = drawerLayoutPosition == 'right'

  return (
    <>
      <StatusBar />
      <View style={styles.container}>
        {/* 侧边导航栏位置跟随「导航、收藏列表弹出方向」设置 */}
        {isNavOnRight ? null : <Aside />}
        <View style={styles.content}>
          <Header />
          <Main />
          <PlayerBar isHome />
        </View>
        {isNavOnRight ? <Aside /> : null}
      </View>
    </>
  )
}
