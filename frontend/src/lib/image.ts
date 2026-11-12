/**
 * 客户端图片处理：压缩为 JPEG Blob，供上传与草稿预览使用。
 */

export interface CompressedImage {
  blob: Blob
  width: number
  height: number
}

const DEFAULT_MAX_EDGE = 2048
const DEFAULT_QUALITY = 0.85

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('无法读取图片'))
    }
    image.src = url
  })
}

export async function compressImageFile(
  file: File,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_QUALITY
): Promise<CompressedImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }

  const image = await loadImage(file)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height

  if (!width || !height) {
    throw new Error('图片尺寸无效')
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const targetWidth = Math.max(1, Math.round(width * scale))
  const targetHeight = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器不支持图片处理')

  // JPEG 不支持透明，铺白底避免透明区域变黑
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, targetWidth, targetHeight)
  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error('图片压缩失败'))
      },
      'image/jpeg',
      quality
    )
  })

  return { blob, width: targetWidth, height: targetHeight }
}

export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name || 'reference.jpg', { type: blob.type || 'image/jpeg' })
}

export function createPreviewUrl(blob: Blob): string {
  return URL.createObjectURL(blob)
}

export function revokePreviewUrl(url: string | null | undefined): void {
  if (url) URL.revokeObjectURL(url)
}
