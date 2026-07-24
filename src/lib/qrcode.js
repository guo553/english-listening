function decodeQRFromImageSource(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = function () {
      const scale = Math.min(1, 1000 / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)
      const imageData = ctx.getImageData(0, 0, width, height)
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      })
      if (code && code.data) {
        resolve(code.data)
      } else {
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

function decodeQRFromBase64(base64) {
  return decodeQRFromImageSource(base64)
}
