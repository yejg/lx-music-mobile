import { memo, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'

import SubTitle from '../../components/SubTitle'
import CheckBox from '@/components/common/CheckBox'
import { useSettingValue } from '@/store/setting/hook'
import { useI18n } from '@/lang'
import { updateSetting } from '@/core/common'

const LIST = [1, 2, 3, 4, 5] as const

const useActive = (count: number) => {
  const maxConcurrent = useSettingValue('download.maxConcurrent')
  const isActive = useMemo(() => maxConcurrent == count, [maxConcurrent, count])
  return isActive
}

const Item = ({ count }: { count: number }) => {
  const isActive = useActive(count)
  return <CheckBox marginRight={8} check={isActive} label={`${count}`} onChange={() => { updateSetting({ 'download.maxConcurrent': count }) }} need />
}

export default memo(() => {
  const t = useI18n()

  return (
    <SubTitle title={t('setting_download_max_concurrent')}>
      <View style={styles.list}>
        {LIST.map(count => <Item key={count} count={count} />)}
      </View>
    </SubTitle>
  )
})

const styles = StyleSheet.create({
  list: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
