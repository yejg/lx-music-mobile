import RNFS from 'react-native-fs'

/**
 * SAF（存储访问框架）content URI 解析工具
 *
 * 通过 AndroidScoped.openDocumentTree() 选择的目录返回的是 content URI，例如：
 *   content://com.android.externalstorage.documents/tree/primary%3AMusic
 *   content://com.android.externalstorage.documents/tree/primary%3AMusic/document/primary%3AMusic
 *   content://com.android.externalstorage.documents/tree/1A2B-3C4D%3AMusic
 *   content://com.android.providers.downloads.documents/tree/downloads
 *
 * 而 RNFS.downloadFile() 的 toFile 只接受真实文件系统路径，
 * 直接传 content URI 会导致写入失败、下载进度卡在 0%。
 *
 * 本模块负责把这类 URI 还原成 /storage/emulated/0/Music 这样的真实路径。
 */

const EXTERNAL_STORAGE_DOC = 'com.android.externalstorage.documents'
const DOWNLOADS_DOC = 'com.android.providers.downloads.documents'

export interface ResolveResult {
  /** 解析出的真实路径；解析失败时为 null */
  path: string | null
  /** 是否为 SAF content URI */
  isContentUri: boolean
  /** 解析失败时的原因说明 */
  reason?: string
}

const isContentUri = (value: string) => /^content:\/\//i.test(value)

/**
 * 安全地解码 URI 中的百分号编码（如 %3A → :）
 */
const safeDecode = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * 规范化路径，去掉多余的斜杠
 */
const normalizePath = (path: string) => {
  const normalized = path.replace(/\/{2,}/g, '/')
  return normalized.length > 1 ? normalized.replace(/\/+$/, '') : normalized
}

/**
 * 把 SAF 的 documentId 转成真实路径
 * documentId 形如：
 *   primary:Music
 *   primary:Music/sub
 *   1A2B-3C4D:Music
 *   home:xxx
 * @param documentId 已解码的 documentId
 * @param volumeHints 可选的卷路径映射（如 { '1A2B-3C4D': '/storage/1A2B-3C4D' }）
 */
const resolveDocumentId = async(documentId: string, volumeHints?: Record<string, string>): Promise<ResolveResult> => {
  const sepIndex = documentId.indexOf(':')
  if (sepIndex < 0) {
    return { path: null, isContentUri: true, reason: 'documentId 中没有找到卷分隔符' }
  }

  const volume = documentId.slice(0, sepIndex)
  const relative = documentId.slice(sepIndex + 1).replace(/^\/+/, '')

  let volumePath: string | null = null

  if (volume === 'primary') {
    // 主存储：/storage/emulated/0
    volumePath = RNFS.ExternalStorageDirectoryPath || '/storage/emulated/0'
  } else if (volume === 'home') {
    // 部分应用的 Documents 根目录，通常是主存储下的 Documents
    volumePath = `${RNFS.ExternalStorageDirectoryPath || '/storage/emulated/0'}/Documents`
  } else if (volumeHints?.[volume]) {
    volumePath = volumeHints[volume]
  } else {
    // SD 卡等可移动存储：卷名一般是 UUID，其余下的挂载点是 /storage/<UUID>
    // 先尝试直接拼 /storage/<volume>，再校验目录是否存在
    const candidate = `/storage/${volume}`
    if (await RNFS.exists(candidate).catch(() => false)) {
      volumePath = candidate
    } else {
      // 再尝试从外部存储列表中匹配（按路径包含 UUID 定位挂载点）
      const externalPaths = await RNFS.getAllExternalFilesDirs().catch(() => [] as string[])
      const matched = externalPaths.find(p => p.includes(volume))
      if (matched) volumePath = matched.split('/Android/')[0] ?? null
    }
  }

  if (!volumePath) {
    return { path: null, isContentUri: true, reason: `无法定位存储卷 "${volume}" 的挂载路径` }
  }

  return {
    path: normalizePath(relative ? `${volumePath}/${relative}` : volumePath),
    isContentUri: true,
  }
}

/**
 * 把 SAF content URI 解析成真实文件路径
 * @param uri openDocumentTree 返回的 path 字段
 */
export const resolveSafPath = async(uri: string): Promise<ResolveResult> => {
  const raw = uri.trim()
  if (!isContentUri(raw)) {
    // 已经是真实路径，直接规范化后返回
    return { path: normalizePath(raw), isContentUri: false }
  }

  // content://<authority>/tree/<treeId>/document/<documentId>
  const treeIndex = raw.indexOf('/tree/')
  if (treeIndex < 0) {
    return { path: null, isContentUri: true, reason: '不支持的 content URI 格式（缺少 /tree/）' }
  }

  const authority = raw.slice('content://'.length, treeIndex).split('/')[0]
  let rest = raw.slice(treeIndex + '/tree/'.length)
  // 去掉可能存在的 query 参数
  const queryIndex = rest.indexOf('?')
  if (queryIndex >= 0) rest = rest.slice(0, queryIndex)

  const docIndex = rest.indexOf('/document/')
  const treeIdEncoded = docIndex >= 0 ? rest.slice(0, docIndex) : rest
  const treeId = safeDecode(treeIdEncoded)

  if (authority == DOWNLOADS_DOC) {
    // 下载目录：tree/downloads 或 downloads:<id>
    // Download 目录的真实路径可以直接用 RNFS.DownloadDirectoryPath
    if (treeId == 'downloads' || treeId.startsWith('downloads:')) {
      return { path: normalizePath(RNFS.DownloadDirectoryPath), isContentUri: true }
    }
    return { path: null, isContentUri: true, reason: `暂不支持的下载类目录 "${treeId}"` }
  }

  if (authority == EXTERNAL_STORAGE_DOC) {
    return resolveDocumentId(treeId)
  }

  return { path: null, isContentUri: true, reason: `暂不支持的存储提供者 "${authority}"` }
}

export { isContentUri }
