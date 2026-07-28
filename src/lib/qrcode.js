// ===== 二维码解码工具 =====
// 基于 jsQR 库，支持从图片 URL / 文件 / base64 数据中识别二维码

// 从图片源（URL 或 base64 data URI）解码二维码
// 步骤：加载图片 → 绘制到 Canvas（缩小到 1000px 内加速） → 用 jsQR 逐像素扫描
function decodeQRFromImageSource(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = function () {
      // 按比例缩小到最大 1000px，提高解码速度
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      // 提取像素数据进行 QR 解码
      const imageData = ctx.getImageData(0, 0, width, height)

      // 第一次尝试：不反转颜色（速度更快）
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      })
      if (code && code.data) {
        resolve(code.data)
      } else {
        // 第一次失败后尝试反转颜色（兼容反色二维码）
        const code2 = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        })
        if (code2 && code2.data) {
          resolve(code2.data)
        } else {
          reject(new Error('未能在图片中识别出二维码'))
        }
      }
    }
    img.onerror = function () {
      reject(new Error('图片加载失败'))
    }
    img.src = src
  })
}

// 从 File 对象解码（通过 FileReader 读取为 data URL）
function decodeQRFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = function (e) {
      decodeQRFromImageSource(e.target.result).then(resolve).catch(reject)
    }
    reader.onerror = function () {
      reject(new Error('文件读取失败'))
    }
    reader.readAsDataURL(file)
  })
}

// 从 base64 字符串解码（直接传给 decodeQRFromImageSource）
function decodeQRFromBase64(base64) {
  return decodeQRFromImageSource(base64)
}
