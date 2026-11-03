import RNFS from 'react-native-fs'
import { importUserApi } from '@/core/userApi'
import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'

const DEFAULT_SOURCE_ASSET = 'flower-v1.js'
const DEFAULT_SOURCE_IMPORTED_KEY = storageDataPrefix.defaultSourceImported

const readAssetScript = async() => {
  if (RNFS.readFileAssets) {
    return RNFS.readFileAssets(DEFAULT_SOURCE_ASSET)
  }
  throw new Error('readFileAssets is not available on this platform')
}

/**
 * 首次启动时导入内置音源并作为默认音源
 * 只在第一次启动时导入一次，之后无论用户是否删除都不再重复导入
 * @returns 需要设为默认音源的 id；不是第一次启动或导入失败时返回 null
 */
export const initDefaultSource = async(): Promise<string | null> => {
  // 已经导入过就直接跳过（用户之后删掉也不会再恢复）
  if (await getData<string>(DEFAULT_SOURCE_IMPORTED_KEY)) return null

  try {
    const script = await readAssetScript()
    const info = await importUserApi(script)
    await saveData(DEFAULT_SOURCE_IMPORTED_KEY, '1')
    return info.id
  } catch (err: any) {
    // 不写标记，下次启动还会再尝试一次
    console.log('init default source failed:', err.message ?? err)
    return null
  }
}
