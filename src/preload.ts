// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

export interface CSVFile {
  filename: string;
  content: string;
}

export interface LoadedData {
  결제데이터: CSVFile[];
  누적결제데이터: CSVFile[];
  주문데이터: CSVFile[];
}

const electronAPI = {
  selectDirectory: (): Promise<string | null> => 
    ipcRenderer.invoke('select-directory'),
  
  loadData: (basePath: string): Promise<LoadedData> => 
    ipcRenderer.invoke('load-data', basePath),
  
  getDefaultPath: (): Promise<string> => 
    ipcRenderer.invoke('get-default-path'),
  
  checkDirectoryExists: (dirPath: string): Promise<boolean> => 
    ipcRenderer.invoke('check-directory-exists', dirPath),
  
  listAvailableDates: (basePath: string): Promise<string[]> => 
    ipcRenderer.invoke('list-available-dates', basePath),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// TypeScript 타입 정의를 위한 declare
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}