const { app, BrowserWindow, ipcMain, shell, screen } = require("electron");
const path = require("path");

// Pass --dev flag to load Vite dev server instead of built dist/
const isDev = process.argv.includes("--dev");

let win;

function createWindow() {
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    // Default: full panel (320×420) in bottom-right corner
    width: 320,
    height: 420,
    x: sw - 340,
    y: sh - 440,

    // Widget appearance
    frame: false,          // No title bar — custom UI only
    transparent: true,     // Allows rounded corners / glassmorphism
    alwaysOnTop: true,     // Stays above all other windows
    skipTaskbar: true,     // Doesn't appear in taskbar
    resizable: false,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,   // Security: isolate renderer from Node
      nodeIntegration: false,   // Security: no Node in renderer
    },
  });

  // Stays above fullscreen apps (e.g. VS Code, games, presentation mode)
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev) {
    // Load Vite dev server — hot reload works
    win.loadURL("http://localhost:8080");
    // Detached DevTools so they don't shift the widget
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Load production build — TanStack Start outputs to dist/client/
    win.loadFile(path.join(__dirname, "../dist/client/index.html"));
  }

  // Prevent accidental close — widget should persist
  win.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  // On Windows/Linux, quit when all windows closed
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.on("activate", () => {
  // macOS: re-create window if dock icon clicked
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC handlers ──────────────────────────────────────────────────────────────

/**
 * Shrink to 64×64 floating bubble — default working state.
 * User is actively working, widget stays out of the way.
 */
ipcMain.on("minimize-to-bubble", () => {
  if (!win) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(64, 64);
  win.setPosition(sw - 84, sh - 84);
});

/**
 * Shrink to 40×40 hyperfocus dot — deep flow detected.
 * Barely visible. No voice. No reminders.
 */
ipcMain.on("minimize-to-hyperfocus", () => {
  if (!win) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(40, 40);
  win.setPosition(sw - 56, sh - 56);
});

/**
 * Restore to 320×420 full panel — reminder fired or user tapped bubble.
 */
ipcMain.on("expand-to-panel", () => {
  if (!win) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(320, 420);
  win.setPosition(sw - 340, sh - 440);
  win.show();
});

/**
 * Standard window minimize — hides widget to taskbar / bubble.
 * Called by the minimize button in the React UI header.
 */
ipcMain.on("minimize-window", () => {
  if (!win) return;
  win.minimize();
});

/**
 * Open the DigitalOcean insights page in the system browser.
 * Judges can access this URL without installing the app.
 */
ipcMain.on("open-insights", () => {
  shell.openExternal("https://taskanium.ondigitalocean.app/insights");
});
