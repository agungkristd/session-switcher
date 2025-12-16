/// <reference types="chrome"/>
import {
  getDomain,
  loadSessions,
  saveSessionToStorage,
  updateSessionsInStorage,
  captureLocalStorage,
  restoreStorage,
  clearStorage,
  getActiveSession,
  setActiveSession,
} from "./storage";
import { renderSessions } from "./ui";
import type { Session, StorageData } from "./types.ts";

document.addEventListener("DOMContentLoaded", async () => {
  // Top-level elements
  const sessionList = document.getElementById("session-list");
  const emptyState = document.querySelector(".empty-state") as HTMLElement;
  const addSessionContainer = document.getElementById(
    "add-session-container"
  ) as HTMLElement;

  // Buttons
  const newSessionBtn = document.getElementById("new-session-btn"); // Reset Site
  const addSessionBtn = document.getElementById("add-session-btn"); // Save Session
  const saveSessionConfirm = document.getElementById("save-session-confirm");
  const cancelSessionSave = document.getElementById("cancel-session-save");
  const newSessionNameInput = document.getElementById(
    "new-session-name"
  ) as HTMLInputElement;
  const themeBtn = document.getElementById("theme-btn");

  // State for Create vs Rename
  let isRenaming = false;
  let sessionToRenameIndex: number | null = null;

  // Theme Logic
  const htmlObj = document.documentElement;
  const currentTheme = localStorage.getItem("theme");
  if (
    currentTheme === "dark" ||
    (!currentTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
  ) {
    htmlObj.classList.add("dark");
  }

  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      if (htmlObj.classList.contains("dark")) {
        htmlObj.classList.remove("dark");
        localStorage.setItem("theme", "light");
      } else {
        htmlObj.classList.add("dark");
        localStorage.setItem("theme", "dark");
      }
    });
  }

  // Domain Logic
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id) return;

  const domain = await getDomain(tab);
  if (!domain) return;

  // Initial Load
  await refresh();

  // --- Actions ---

  function getCookieUrl(cookie: chrome.cookies.Cookie): string {
    const domain = cookie.domain.startsWith(".")
      ? cookie.domain.slice(1)
      : cookie.domain;
    return `http${cookie.secure ? "s" : ""}://${domain}${cookie.path}`;
  }

  async function handleSaveSession(name: string) {
    // Capture cookies
    const cookies = await chrome.cookies.getAll({ url: tab.url });
    // Capture Storage
    const storage = await captureLocalStorage(tab.id!);

    const newSession: Session = {
      name,
      timestamp: Date.now(),
      cookies,
      localStorage: storage,
    };

    await saveSessionToStorage(domain!, newSession);
    await setActiveSession(domain!, name);
    refresh();
  }

  async function handleRestoreSession(session: Session) {
    // Clear current
    await clearStorage(tab.id!);
    const currentCookies = await chrome.cookies.getAll({ url: tab.url });
    for (const cookie of currentCookies) {
      await chrome.cookies.remove({
        url: getCookieUrl(cookie),
        name: cookie.name,
      });
    }

    // Restore cookies
    for (const cookie of session.cookies) {
      const newCookie: any = { ...cookie };
      delete newCookie.hostOnly;
      delete newCookie.session;

      if (cookie.hostOnly) {
        delete newCookie.domain;
      }

      newCookie.url = getCookieUrl(cookie);
      await chrome.cookies.set(newCookie);
    }

    // Restore Storage
    if (session.localStorage) {
      await restoreStorage(tab.id!, session.localStorage);
    }

    // Update Last Used
    const currentSessions = await loadSessions(domain!);
    const sessionIndex = currentSessions.findIndex(
      (s) => s.name === session.name
    );
    if (sessionIndex !== -1) {
      currentSessions[sessionIndex].lastUsed = Date.now();
      await updateSessionsInStorage(domain!, currentSessions);
    }

    await setActiveSession(domain!, session.name);

    await chrome.tabs.reload(tab.id!);
    window.close();
  }

  // Initiate Rename (Reuse add-session-container)
  function handleInitiateRename(index: number, currentName: string) {
    isRenaming = true;
    sessionToRenameIndex = index;

    // Update UI for Rename Mode
    newSessionNameInput.value = currentName;
    newSessionNameInput.placeholder = "New Session Name";
    if (saveSessionConfirm) saveSessionConfirm.textContent = "Rename";

    addSessionContainer.classList.remove("hidden");
    newSessionNameInput.focus();
  }

  // Execute Rename
  async function performRename(newName: string) {
    if (sessionToRenameIndex === null) return;

    const currentSessions = await loadSessions(domain!);
    const activeName = await getActiveSession(domain!);

    // If we are renaming the active session, we need to update the active pointer too
    const isRenameActive =
      currentSessions[sessionToRenameIndex].name === activeName;

    currentSessions[sessionToRenameIndex].name = newName;
    await updateSessionsInStorage(domain!, currentSessions);

    if (isRenameActive) {
      await setActiveSession(domain!, newName);
    }

    resetFormState();
    refresh();
  }

  function resetFormState() {
    addSessionContainer.classList.add("hidden");
    newSessionNameInput.value = "";
    newSessionNameInput.placeholder = "Session Name (e.g. Personal)";
    if (saveSessionConfirm) saveSessionConfirm.textContent = "Save Session";
    isRenaming = false;
    sessionToRenameIndex = null;
  }

  async function handleDeleteSession(index: number) {
    const currentSessions = await loadSessions(domain!);
    // Check if we are deleting the active session
    const sessionToDelete = currentSessions[index];
    const activeName = await getActiveSession(domain!);

    if (sessionToDelete && sessionToDelete.name === activeName) {
      await setActiveSession(domain!, null);
    }

    currentSessions.splice(index, 1);
    await updateSessionsInStorage(domain!, currentSessions);
    refresh();
  }

  async function handleReorderSessions(src: number, dest: number) {
    const currentSessions = await loadSessions(domain!);
    if (
      src < 0 ||
      src >= currentSessions.length ||
      dest < 0 ||
      dest >= currentSessions.length
    )
      return;
    const [moved] = currentSessions.splice(src, 1);
    currentSessions.splice(dest, 0, moved);
    await updateSessionsInStorage(domain!, currentSessions);
    refresh();
  }

  async function handleResetSite() {
    await clearStorage(tab.id!);
    const currentCookies = await chrome.cookies.getAll({ url: tab.url });
    for (const cookie of currentCookies) {
      await chrome.cookies.remove({
        url: getCookieUrl(cookie),
        name: cookie.name,
      });
    }
    await setActiveSession(domain!, null);
    await chrome.tabs.reload(tab.id!);
    window.close();
  }

  async function refresh() {
    const sessions = await loadSessions(domain!);
    const activeSessionName = await getActiveSession(domain!);
    render(sessions, activeSessionName);
  }

  function render(data: Session[], activeSessionName: string | null = null) {
    if (!sessionList) return;
    renderSessions(
      data,
      sessionList,
      emptyState,
      handleDeleteSession,
      handleRestoreSession,
      handleReorderSessions,
      handleInitiateRename,
      activeSessionName
    );
  }

  // --- Event Listeners ---
  if (newSessionBtn) newSessionBtn.addEventListener("click", handleResetSite);

  if (addSessionBtn) {
    addSessionBtn.addEventListener("click", () => {
      // Ensure we are in Create Mode
      isRenaming = false;
      sessionToRenameIndex = null;
      newSessionNameInput.value = "";
      newSessionNameInput.placeholder = "Session Name (e.g. Personal)";
      if (saveSessionConfirm) saveSessionConfirm.textContent = "Save Session";

      addSessionContainer.classList.remove("hidden");
      newSessionNameInput.focus();
    });
  }

  if (cancelSessionSave) {
    cancelSessionSave.addEventListener("click", () => {
      resetFormState();
    });
  }

  if (saveSessionConfirm) {
    saveSessionConfirm.addEventListener("click", async () => {
      const name = newSessionNameInput.value.trim();
      if (!name) return;

      if (isRenaming) {
        await performRename(name);
      } else {
        await handleSaveSession(name);
        addSessionContainer.classList.add("hidden");
        newSessionNameInput.value = "";
      }
    });
  }

  // Allow Enter key to submit (handles both save and rename)
  if (newSessionNameInput) {
    newSessionNameInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        const name = newSessionNameInput.value.trim();
        if (!name) return;

        if (isRenaming) {
          await performRename(name);
        } else {
          await handleSaveSession(name);
          addSessionContainer.classList.add("hidden");
          newSessionNameInput.value = "";
        }
      }
    });
  }
});
