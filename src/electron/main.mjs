import { app, BrowserWindow, Menu, dialog, shell, nativeImage } from 'electron'
import electronUpdater from 'electron-updater'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { startServer } from '../server.mjs'

const { autoUpdater } = electronUpdater
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

app.setName('Claude 账号工作台')

let mainWindow = null
let serverPort = 0

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

async function createWindow() {
  serverPort = await pickFreePort()
  await startServer({ host: '127.0.0.1', port: serverPort })

  const iconPath = path.join(PROJECT_ROOT, 'data', 'claudecode.png')
  const icon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 640,
    title: 'Claude 账号工作台',
    icon: icon.isEmpty() ? undefined : icon,
    autoHideMenuBar: process.platform !== 'darwin',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`)
}

function setupAutoUpdater() {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    if (!mainWindow) return
    mainWindow.webContents.executeJavaScript(
      `window.dispatchEvent(new CustomEvent('app-update-available', { detail: ${JSON.stringify({ version: info.version })} }))`
    ).catch(() => {})
  })

  autoUpdater.on('update-downloaded', async (info) => {
    if (!mainWindow) return
    const res = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['现在重启更新', '稍后'],
      defaultId: 0,
      cancelId: 1,
      title: '更新已就绪',
      message: `新版本 v${info.version} 已下载完成`,
      detail: '是否立即重启并安装更新?',
    })
    if (res.response === 0) autoUpdater.quitAndInstall()
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err?.message || err)
  })

  autoUpdater.checkForUpdatesAndNotify().catch(e => console.error('[updater] initial check failed:', e))
}

function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '文件',
      submenu: [
        {
          label: '检查更新…',
          click: async () => {
            if (!app.isPackaged) {
              dialog.showMessageBox(mainWindow, {
                type: 'info', title: '检查更新',
                message: '开发模式下不检查更新',
                detail: '打包后的版本会自动检查 GitHub Releases。',
              })
              return
            }
            try {
              const r = await autoUpdater.checkForUpdates()
              const latest = r?.updateInfo?.version
              if (!latest || latest === app.getVersion()) {
                dialog.showMessageBox(mainWindow, {
                  type: 'info', title: '检查更新',
                  message: `当前已是最新版本 (v${app.getVersion()})`,
                })
              }
            } catch (e) {
              dialog.showMessageBox(mainWindow, {
                type: 'error', title: '检查更新失败',
                message: String(e?.message || e),
              })
            }
          },
        },
        { type: 'separator' },
        { role: isMac ? 'close' : 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        {
          label: '打开项目主页',
          click: () => shell.openExternal('https://github.com/hellonestor/Claude-Accounts-Usage'),
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(async () => {
  await createWindow()
  buildMenu()
  setupAutoUpdater()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
