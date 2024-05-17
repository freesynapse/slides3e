
import { app, BrowserWindow, ipcMain } from 'electron';

let win;

process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

//
app.on('ready', () => {
    win = new BrowserWindow({ 
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        width: 1280, 
        height: 760, 
        fullscreen: true,
    });
 
    // Load the HTML file into the Window
    win.loadFile('index.html');
 
});

//
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// (inter-process communication): quit condition from main.js
ipcMain.handle('quit-app', () => {
    app.quit();
})
