import RNFS from 'react-native-fs'
import { getMusicUrl } from '@/core/music'
import { getLyricInfo } from '@/core/music/online'
import { mkdir, existsFile, downloadFile, unlink, writeFile, readDir, stat } from '@/utils/fs'
import { checkAllFilesAccess, requestStoragePermission, toast, formatMusicName } from '@/utils/tools'
import { getData, saveData } from '@/plugins/storage'
import { filterFileName } from '@/utils/common'
import { resolveSafPath, isContentUri } from '@/utils/safPath'
import settingState from '@/store/setting/state'
import { storageDataPrefix } from '@/config/constant'

const qualityExtMap: Record<Exclude<LX.Quality, '192k' | 'ape' | 'wav'>, string> = {
  '128k': 'mp3',
  '320k': 'mp3',
  flac: 'flac',
  flac24bit: 'flac',
}

const getExt = (quality: LX.Quality) => (qualityExtMap as Record<string, string>)[quality] ?? 'mp3'

const getDefaultDownloadDir = () => {
  return RNFS.DownloadDirectoryPath || (RNFS.ExternalStorageDirectoryPath + '/Download')
}

/**
 * 获取下载根目录（不含 lx-music 子目录）
 * 会把 SAF 返回的 content URI 解析成真实文件路径
 * @throws 当自定义目录无法解析为真实路径时抛出
 */
const resolveDownloadBaseDir = async(): Promise<string> => {
  const savePath = settingState.setting['download.savePath']
  if (!savePath) return getDefaultDownloadDir()

  const result = await resolveSafPath(savePath)
  if (!result.path) {
    throw new Error(global.i18n.t('download_save_path_invalid', { path: savePath, reason: result.reason ?? '' }))
  }
  return result.path
}

const getDownloadDir = async() => {
  const baseDir = await resolveDownloadBaseDir()
  const dir = `${baseDir}/lx-music`
  if (!await existsFile(dir)) await mkdir(dir)
  return dir
}

const buildFileName = (musicInfo: LX.Music.MusicInfo, quality: LX.Quality) => {
  const rawName = formatMusicName(settingState.setting['download.fileName'], musicInfo.name, musicInfo.singer)
  const safeName = filterFileName(rawName)
  return `${safeName}.${getExt(quality)}`
}

const generateId = (musicInfo: LX.Music.MusicInfo, quality: LX.Quality) => {
  return `${musicInfo.source}_${musicInfo.id}_${quality}_${Date.now()}`
}

const formatSize = (bytes: number) => {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`
}

const formatSpeed = (bytesPerSecond: number) => {
  if (bytesPerSecond <= 0) return ''
  return `${formatSize(bytesPerSecond)}/s`
}

const TASK_LIST_KEY = storageDataPrefix.downloadTaskList

let taskList: LX.Download.ListItem[] = []
let isTaskListLoaded = false
let runningTasks = 0

const emitListUpdate = () => {
  global.app_event.downloadListUpdate()
}

const saveTaskList = async() => {
  await saveData(TASK_LIST_KEY, taskList)
}

const loadTaskList = async() => {
  if (isTaskListLoaded) return taskList
  const list = await getData<LX.Download.ListItem[]>(TASK_LIST_KEY)
  if (!isTaskListLoaded) {
    taskList = list ?? []
    isTaskListLoaded = true
  }
  return taskList
}

const getWaitingTasks = () => taskList.filter(t => t.status == 'waiting' || t.status == 'error')

const updateTask = (id: string, patch: Partial<LX.Download.ListItem>) => {
  const index = taskList.findIndex(t => t.id == id)
  if (index < 0) return
  taskList[index] = { ...taskList[index], ...patch }
  void saveTaskList()
  emitListUpdate()
}

const removeTask = (id: string) => {
  const index = taskList.findIndex(t => t.id == id)
  if (index < 0) return null
  const task = taskList[index]
  taskList.splice(index, 1)
  void saveTaskList()
  emitListUpdate()
  return task
}

const setTaskStatus = (id: string, status: LX.Download.DownloadTaskStatus, statusText = '') => {
  updateTask(id, { status, statusText })
}

const startNextTask = async() => {
  const maxConcurrent = settingState.setting['download.maxConcurrent']
  if (runningTasks >= maxConcurrent) return
  const waiting = getWaitingTasks()
  if (!waiting.length) return
  const task = waiting[0]
  runningTasks++
  await runTask(task)
  runningTasks--
  void startNextTask()
}

const downloadLyric = async(musicInfo: LX.Music.MusicInfoOnline, lyricPath: string) => {
  try {
    const lyricInfo = await getLyricInfo({ musicInfo, isRefresh: false, allowToggleSource: true })
    if (!lyricInfo?.lyric) return
    await writeFile(lyricPath, lyricInfo.lyric)
  } catch (err: any) {
    console.log('download lyric failed:', err.message ?? err)
  }
}

/**
 * 确认目标目录可写，不可写时抛出明确的错误
 * 主要用于 Android 11+ 缺少「所有文件访问权限」时写入 Music 等目录的场景
 */
const ensureWritableDir = async(filePath: string) => {
  const dir = filePath.slice(0, filePath.lastIndexOf('/'))
  try {
    if (!await existsFile(dir)) await mkdir(dir)
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    if (/EACCES|EPERM|Permission denied/i.test(msg)) {
      throw new Error(global.i18n.t('download_permission_denied'))
    }
    throw err
  }
}

const runTask = async(task: LX.Download.ListItem) => {
  setTaskStatus(task.id, 'run', global.i18n.t('download_status_getting_url'))

  let downloadJobId: number | null = null
  let lastBytes = 0
  let lastTime = Date.now()

  try {
    const musicInfo = task.metadata.musicInfo

    // 兼容历史任务：早期版本可能把 SAF content URI 直接拼进了 filePath
    if (isContentUri(task.metadata.filePath)) {
      const parsed = await resolveSafPath(task.metadata.filePath)
      if (!parsed.path) {
        setTaskStatus(task.id, 'error', global.i18n.t('download_save_path_invalid', {
          path: task.metadata.filePath,
          reason: parsed.reason ?? '',
        }))
        return
      }
      task.metadata.filePath = parsed.path
      void saveTaskList()
    }

    // 写入前先确认目录可写，避免因缺少「所有文件访问权限」而卡在 0%
    await ensureWritableDir(task.metadata.filePath)

    const url = task.metadata.url ?? await getMusicUrl({ musicInfo, quality: task.metadata.quality, isRefresh: false, allowToggleSource: true })
    if (!url) {
      setTaskStatus(task.id, 'error', global.i18n.t('download_url_empty'))
      return
    }

    task.metadata.url = url
    setTaskStatus(task.id, 'run', global.i18n.t('download_status_downloading'))

    const result = await downloadFile(url, task.metadata.filePath, {
      connectionTimeout: 30 * 1000,
      readTimeout: 30 * 1000,
      begin: (res) => {
        downloadJobId = res.jobId
      },
      progress: (res) => {
        const now = Date.now()
        const deltaTime = now - lastTime
        let speed = ''
        if (deltaTime > 0) {
          const deltaBytes = res.bytesWritten - lastBytes
          speed = formatSpeed((deltaBytes / deltaTime) * 1000)
          lastBytes = res.bytesWritten
          lastTime = now
        }
        updateTask(task.id, {
          downloaded: res.bytesWritten,
          total: res.contentLength,
          progress: res.contentLength > 0 ? Math.floor((res.bytesWritten / res.contentLength) * 100) : 0,
          speed,
        })
      },
    }).promise

    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`HTTP ${result.statusCode}`)
    }

    if (settingState.setting['download.isDownloadLyric']) {
      const lyricPath = task.metadata.filePath.replace(/\.[^.]+$/, '.lrc')
      await downloadLyric(musicInfo, lyricPath)
      task.metadata.lyricPath = lyricPath
    }

    updateTask(task.id, {
      status: 'completed',
      statusText: global.i18n.t('download_status_completed'),
      downloaded: result.bytesWritten,
      total: result.bytesWritten,
      progress: 100,
      speed: '',
      isComplate: true,
    })
  } catch (err: any) {
    console.log(err)
    if (downloadJobId != null) {
      try {
        RNFS.stopDownload(downloadJobId)
      } catch {}
    }
    updateTask(task.id, {
      status: 'error',
      statusText: err.message ?? String(err),
      speed: '',
    })
  }
}

export const addDownloadTask = async(musicInfo: LX.Music.MusicInfo, quality?: LX.Quality) => {
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

  // 自定义了非 Download 目录（如 Music）时，需要「所有文件访问权限」
  if (settingState.setting['download.savePath']) await checkAllFilesAccess()

  await loadTaskList()

  const targetQuality = quality ?? settingState.setting['player.playQuality']

  let dir: string
  try {
    dir = await getDownloadDir()
  } catch (err: any) {
    toast(String(err?.message ?? err), 'long')
    return
  }

  const fileName = buildFileName(musicInfo, targetQuality)
  const filePath = `${dir}/${fileName}`

  const existing = taskList.find(t => t.metadata.musicInfo.id == musicInfo.id && t.metadata.quality == targetQuality)
  if (existing) {
    toast(global.i18n.t('download_task_exists'))
    return
  }

  const task: LX.Download.ListItem = {
    id: generateId(musicInfo, targetQuality),
    status: 'waiting',
    statusText: global.i18n.t('download_status_waiting'),
    downloaded: 0,
    total: 0,
    progress: 0,
    speed: '',
    isComplate: false,
    metadata: {
      musicInfo,
      url: null,
      quality: targetQuality,
      ext: getExt(targetQuality) as LX.Download.FileExt,
      fileName,
      filePath,
    },
  }

  taskList.unshift(task)
  void saveTaskList()
  emitListUpdate()
  toast(global.i18n.t('download_task_added'))
  void startNextTask()
}

export const pauseDownloadTask = (id: string) => {
  const task = taskList.find(t => t.id == id)
  if (!task || task.status != 'run') return
  updateTask(id, { status: 'pause', statusText: global.i18n.t('download_status_paused'), speed: '' })
}

export const resumeDownloadTask = async(id: string) => {
  const task = taskList.find(t => t.id == id)
  if (!task || (task.status != 'pause' && task.status != 'error')) return
  updateTask(id, { status: 'waiting', statusText: global.i18n.t('download_status_waiting') })
  void startNextTask()
}

export const retryDownloadTask = (id: string) => {
  const task = taskList.find(t => t.id == id)
  if (!task || task.status != 'error') return
  updateTask(id, { status: 'waiting', statusText: global.i18n.t('download_status_waiting'), downloaded: 0, total: 0, progress: 0, speed: '' })
  void startNextTask()
}

export const removeDownloadTask = async(id: string, deleteFile = false) => {
  const task = removeTask(id)
  if (!task) return
  if (deleteFile) {
    try {
      if (await existsFile(task.metadata.filePath)) await unlink(task.metadata.filePath)
      if (task.metadata.lyricPath && await existsFile(task.metadata.lyricPath)) await unlink(task.metadata.lyricPath)
    } catch (err: any) {
      console.log('delete download file failed:', err.message ?? err)
    }
  }
}

export const getDownloadTaskList = async() => {
  await loadTaskList()
  return [...taskList]
}

export const getDownloadedFiles = async() => {
  const dir = await getDownloadDir()
  if (!await existsFile(dir)) return []
  const files = await readDir(dir)
  const audioExts = ['mp3', 'flac', 'wav', 'ape']
  return files
    .filter(file => audioExts.some(ext => file.name.toLowerCase().endsWith(`.${ext}`)))
    .map(file => {
      const filePath = `${dir}/${file.name}`
      return {
        name: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        filePath,
        ext: file.name.split('.').pop() ?? '',
      }
    })
}

export const getDownloadedFileSize = async(filePath: string) => {
  try {
    const info = await stat(filePath)
    return info.size
  } catch {
    return 0
  }
}

export const clearCompletedTasks = () => {
  taskList = taskList.filter(t => t.status != 'completed')
  void saveTaskList()
  emitListUpdate()
}

export const initDownloadManager = async() => {
  await loadTaskList()
  // reset running tasks to waiting on startup
  for (const task of taskList) {
    if (task.status == 'run') {
      task.status = 'waiting'
      task.statusText = global.i18n.t('download_status_waiting')
      task.speed = ''
    }
  }
  void saveTaskList()
  emitListUpdate()
  void startNextTask()
}
