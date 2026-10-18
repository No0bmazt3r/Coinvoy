// Shrink screenshots on the phone before upload: long edge ≤ 1568 px, JPEG 0.8 (architecture §11).
// Saves the rider's data and the LLM's tokens; the server re-encodes again anyway.
const MAX_EDGE = 1568

export async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode'))), 'image/jpeg', 0.8))
  } catch {
    return file // an odd format the browser can't decode: let the server decide
  }
}
