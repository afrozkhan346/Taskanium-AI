const { contextBridge, ipcRenderer } = require("electron");

/**
 * Exposes safe IPC calls to the React renderer under window.taskanium
 *
 * Usage in React (safe — works in browser too via optional chaining):
 *   window.taskanium?.minimizeToBubble()
 *   window.taskanium?.expandToPanel()
 *   window.taskanium?.openInsights()
 */
contextBridge.exposeInMainWorld("taskanium", {
  /** Shrinks window to 64×64 floating bubble (working state) */
  minimizeToBubble: () => ipcRenderer.send("minimize-to-bubble"),

  /** Shrinks window to 40×40 hyperfocus dot (deep flow state) */
  minimizeToHyperfocus: () => ipcRenderer.send("minimize-to-hyperfocus"),

  /** Restores window to 320×420 full panel */
  expandToPanel: () => ipcRenderer.send("expand-to-panel"),

  /** Minimizes the window (hides to OS taskbar / bubble) */
  minimizeWindow: () => ipcRenderer.send("minimize-window"),

  /** Opens the DigitalOcean insights page in the system browser */
  openInsights: () => ipcRenderer.send("open-insights"),
});
