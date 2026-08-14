import qrcode from 'qrcode-generator'

/**
 * QR labels the shop prints for itself.
 *
 * The photocopier and the printer have no barcode, so the owner sticks a
 * printed square next to each machine and scans it with the same hand reader
 * he uses for books. This turns a short code into that square.
 *
 * Error correction is set to the highest level on purpose: these end up taped
 * to a counter, and a code that still reads with a corner worn off is worth
 * more than a code that is slightly smaller.
 */
const EC_LEVEL = 'H'

/** Quiet zone, in modules. Below 4 many readers simply refuse the code. */
const QUIET = 4

function build(text: string) {
  const qr = qrcode(0, EC_LEVEL)
  qr.addData(text)
  qr.make()
  return qr
}

/** The code alone, as a data URL — for showing it on screen. */
export function qrDataUrl(text: string, pixels = 220): string {
  const qr = build(text)
  const count = qr.getModuleCount()
  const scale = Math.max(1, Math.floor(pixels / (count + QUIET * 2)))
  const size = (count + QUIET * 2) * scale

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#000000'
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.isDark(row, col)) continue
      ctx.fillRect((col + QUIET) * scale, (row + QUIET) * scale, scale, scale)
    }
  }
  return canvas.toDataURL('image/png')
}

/**
 * The printable label: the code, the service name under it in large type, and
 * a line of small print saying what it is for.
 *
 * The name matters — a counter with two unlabelled squares on it is a counter
 * where the wrong one gets scanned.
 */
export function qrLabelCanvas(text: string, name: string, caption: string): HTMLCanvasElement {
  const qr = build(text)
  const count = qr.getModuleCount()

  const scale = Math.max(4, Math.round(520 / (count + QUIET * 2)))
  const codeSize = (count + QUIET * 2) * scale
  const pad = Math.round(scale * 4)
  const nameSize = Math.round(codeSize * 0.11)
  const capSize = Math.round(codeSize * 0.055)
  const textBlock = nameSize + capSize + pad * 2

  const canvas = document.createElement('canvas')
  canvas.width = codeSize + pad * 2
  canvas.height = codeSize + textBlock + pad
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#000000'
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (!qr.isDark(row, col)) continue
      ctx.fillRect(pad + (col + QUIET) * scale, pad + (row + QUIET) * scale, scale, scale)
    }
  }

  const centre = canvas.width / 2
  ctx.textAlign = 'center'
  ctx.fillStyle = '#000000'
  ctx.font = `700 ${nameSize}px "Segoe UI", Arial, sans-serif`
  ctx.fillText(name, centre, codeSize + pad + nameSize * 0.9, canvas.width - pad * 2)

  ctx.fillStyle = '#555555'
  ctx.font = `${capSize}px "Segoe UI", Arial, sans-serif`
  ctx.fillText(caption, centre, codeSize + pad + nameSize + capSize * 1.5, canvas.width - pad * 2)

  return canvas
}

/** Hands the printable label to the browser as a PNG file. */
export function downloadQrLabel(
  text: string,
  name: string,
  caption: string,
  filename: string,
) {
  const canvas = qrLabelCanvas(text, name, caption)
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoked on the next tick: revoking synchronously can beat the download
    // in some browsers and save an empty file.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, 'image/png')
}
