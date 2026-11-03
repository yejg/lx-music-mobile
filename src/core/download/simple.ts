import RNFS from 'react-native-fs'
import { getMusicUrl } from '@/core/music'
import { mkdir, existsFile, downloadFile } from '@/utils/fs'
import { requestStoragePermission, toast, formatMusicName } from '@/utils/tools'
import settingState from '@/store/setting/state'
import { filterFileName } from '@/utils/common'

const qualityExtMap: Record<Exclude<LX.Quality, '192k' | 'ape' | 'wav'>, string> = {
  '128k': 'mp3',
  '320k': 'mp3',
  flac: 'flac',
  flac24bit: 'flac',
}

const getDownloadDir = async() => {
  const baseDir = RNFS.DownloadDirectoryPath || (RNFS.ExternalStorageDirectoryPath + '/Download')
  const dir = `${baseDir}/lx-music`
  if (!await existsFile(dir)) await mkdir(dir)
  return dir
}

const getExt = (quality: LX.Quality) => {
  return (qualityExtMap as Record<string, string>)[quality] ?? 'mp3'
}

const buildFileName = (musicInfo: LX.Music.MusicInfo, quality: LX.Quality) => {
  const rawName = formatMusicName(settingState.setting['download.fileName'], musicInfo.name, musicInfo.singer)
  const safeName = filterFileName(rawName)
  return `${safeName}.${getExt(quality)}`
}

export const downloadMusic = async(musicInfo: LX.Music.MusicInfo, quality?: LX.Quality) => {
  const permission = await requestStoragePermission()
  if (permission === false) {
    toast(global.i18n.t('storage_permission_tip_disagree'))
    return
  }
  if (permission === null) {
    toast(global.i18n.t('storage_permission_tip_disagree_ask_again'))
    return
  }

  if (musicInfo.source == 'local') {
    toast(global.i18n.t('download_failed', { msg: global.i18n.t('download_local_not_supported') }))
    return
  }

  toast(global.i18n.t('download_starting'))

  try {
    const url = await getMusicUrl({ musicInfo, quality, isRefresh: false, allowToggleSource: true })
    if (!url) {
      toast(global.i18n.t('download_failed', { msg: global.i18n.t('download_url_empty') }))
      return
    }
    const targetQuality = quality ?? settingState.setting['player.playQuality']
    const dir = await getDownloadDir()
    const fileName = buildFileName(musicInfo, targetQuality)
    const filePath = `${dir}/${fileName}`

    const result = await downloadFile(url, filePath, {
      connectionTimeout: 30 * 1000,
      readTimeout: 30 * 1000,
    }).promise

    if (result.statusCode >= 200 && result.statusCode < 300) {
      toast(global.i18n.t('download_success', { path: filePath }))
    } else {
      toast(global.i18n.t('download_failed', { msg: `HTTP ${result.statusCode}` }))
    }
  } catch (err: any) {
    console.log(err)
    toast(global.i18n.t('download_failed', { msg: err.message ?? String(err) }))
  }
}
