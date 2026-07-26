const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  fetchPage: (url) => ipcRenderer.invoke('fetch-page', url),
  downloadImage: (url) => ipcRenderer.invoke('download-image', url),
  fetchAnswer: (answerPageUrl, password, grade) => ipcRenderer.invoke('fetch-answer', { answerPageUrl, password, grade }),
  storageSave: (key, data) => ipcRenderer.invoke('storage-save', { key, data }),
  storageLoad: (key) => ipcRenderer.invoke('storage-load', key),
  storageList: () => ipcRenderer.invoke('storage-list'),
  storageDelete: (key) => ipcRenderer.invoke('storage-delete', key),
  clearAllData: () => ipcRenderer.invoke('clear-all-data'),
  storageSave: (key, data) => ipcRenderer.invoke('storage-save', { key, data }),
  storageLoad: (key) => ipcRenderer.invoke('storage-load', key),
  storageList: () => ipcRenderer.invoke('storage-list'),
})
