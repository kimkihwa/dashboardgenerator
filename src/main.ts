import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// CSV 파일 읽기 함수
function readCSVFiles(dirPath: string): { filename: string; content: string }[] {
  try {
    if (!fs.existsSync(dirPath)) {
      return [];
    }
    const files = fs.readdirSync(dirPath);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    
    return csvFiles.map(filename => ({
      filename,
      content: fs.readFileSync(path.join(dirPath, filename), 'utf-8')
    }));
  } catch (error) {
    console.error('Error reading CSV files:', error);
    return [];
  }
}

// 모든 데이터 디렉토리에서 CSV 읽기
function loadAllData(basePath: string) {
  const 결제데이터 = readCSVFiles(path.join(basePath, '결제 데이터'));
  const 누적결제데이터 = readCSVFiles(path.join(basePath, '누적 결제 데이터'));
  const 주문데이터 = readCSVFiles(path.join(basePath, '주문 데이터'));
  
  return {
    결제데이터,
    누적결제데이터,
    주문데이터
  };
}

let mainWindow: BrowserWindow | null = null;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    // Open the DevTools in development mode.
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// IPC Handlers
ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: '데이터 폴더 선택',
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0];
});

ipcMain.handle('load-data', async (_event, basePath: string) => {
  return loadAllData(basePath);
});

ipcMain.handle('get-default-path', () => {
  if (app.isPackaged) {
    // macOS는 .app 번들 밖으로, Windows는 exe 폴더
    const exePath = app.getPath('exe');
    return process.platform === 'darwin'
      ? path.resolve(path.dirname(exePath), '../../../')  // .app 밖으로
      : path.dirname(exePath);  // exe 폴더
  }
  return path.resolve(__dirname, '../../..');
});

ipcMain.handle('check-directory-exists', (_event, dirPath: string) => {
  return fs.existsSync(dirPath);
});

ipcMain.handle('list-available-dates', (_event, basePath: string) => {
  const orderDataPath = path.join(basePath, '주문 데이터');
  if (!fs.existsSync(orderDataPath)) {
    return [];
  }
  
  const files = fs.readdirSync(orderDataPath);
  return files
    .filter(f => f.endsWith('.csv'))
    .map(f => f.replace('.csv', ''))
    .sort();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
