import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { AudioHostService } from './audioHostService'

const isDev = !app.isPackaged
const audioHost = new AudioHostService({
  cwd: process.cwd(),
  resourcesPath: process.resourcesPath,
  isPackaged: app.isPackaged,
})

let mainWindow: BrowserWindow | null = null

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  try {
    await audioHost.start()
    const devices = await audioHost.getDevices()
    console.log(
      `[audio-host] ready — ${devices.inputs.length} inputs, ${devices.outputs.length} outputs`
    )
  } catch (error) {
    console.error('[audio-host] failed to start:', error)
  }

  await createWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    void app.quit()
  }
})

app.on('before-quit', () => {
  void audioHost.stop()
})

ipcMain.handle('audio-host:ping', async () => audioHost.ping())
ipcMain.handle('audio-host:get-devices', async () => audioHost.getDevices())
ipcMain.handle('audio-host:set-device', async (_event, params) => audioHost.setDevice(params))
