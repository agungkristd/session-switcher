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
import type { Session } from "./types";
import { Modal } from "./components/Modal";
import { InputField } from "./components/InputField";

document.addEventListener("DOMContentLoaded", async () => {
  // Top-level elements
  const sessionList = document.getElementById("session-list");
  const emptyState = document.querySelector(".empty-state") as HTMLElement;
  const newSessionBtn = document.getElementById("new-session-btn"); // Reset Site
  const addSessionBtn = document.getElementById("add-session-btn"); // Save Session
  const themeBtn = document.getElementById("theme-btn");

  // Initialize Components
  const modal = new Modal(
    "confirmation-modal",
    "modal-title",
    "modal-message",
    "modal-cancel-btn",
    "modal-confirm-btn"
  );

  const inputField = new InputField(
    "add-session-container",
    "new-session-name",
    "save-session-confirm",
    "cancel-session-save"
  );

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

  async function handleSaveSession(name: string, skipRefresh = false) {
    // Capture cookies
    const cookies = await chrome.cookies.getAll({ url: tab.url });
    // Capture Storage (SAFE WRAPPER around local storage capture)
    let storage: Record<string, string> = {};
    if (
      tab.url &&
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("about:") &&
      !tab.url.startsWith("edge://")
    ) {
      storage = await captureLocalStorage(tab.id!);
    } else {
      console.log("Skipping local storage capture for restricted URL");
    }

    const newSession: Session = {
      name,
      timestamp: Date.now(),
      cookies,
      localStorage: storage,
    };

    // Check if session exists to update, otherwise create new
    const currentSessions = await loadSessions(domain!);
    const existingIndex = currentSessions.findIndex((s) => s.name === name);

    if (existingIndex !== -1) {
      currentSessions[existingIndex] = newSession;
      await updateSessionsInStorage(domain!, currentSessions);
    } else {
      await saveSessionToStorage(domain!, newSession);
    }

    await setActiveSession(domain!, name);
    if (!skipRefresh) refresh();
  }

  async function handleRestoreSession(session: Session) {
    // Auto-save: Before leaving the current session, update its state across the board
    const activeSessionName = await getActiveSession(domain!);
    if (activeSessionName && activeSessionName !== session.name) {
      await handleSaveSession(activeSessionName, true);
    }

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
    // Add check for restricted URLs before creating script injection
    if (
      session.localStorage &&
      tab.url &&
      !tab.url.startsWith("chrome://") &&
      !tab.url.startsWith("about:")
    ) {
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

  // Initiate Rename (Reuse add-session-container via InputField)
  function handleInitiateRename(index: number, currentName: string) {
    isRenaming = true;
    sessionToRenameIndex = index;
    inputField.show(currentName, "New Session Name", "Rename");
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
    inputField.reset();
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
    modal.show(
      "Start New Session?",
      "This will clear your current session and log you out. Save this session first if it's important!",
      "Start New Session",
      async () => {
        // Auto-save current before clearing
        const activeSessionName = await getActiveSession(domain!);
        if (activeSessionName) {
          await handleSaveSession(activeSessionName, true);
        }

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
      },
      true // Destructive (Red button)
    );
  }

  async function refresh() {
    const sessions = await loadSessions(domain!);
    const activeSessionName = await getActiveSession(domain!);
    render(sessions, activeSessionName);
  }

  async function handleSessionSubmission(name: string) {
    if (!name) return;

    const currentSessions = await loadSessions(domain!);
    const existingIndex = currentSessions.findIndex((s) => s.name === name);

    // Check for conflict
    let needsConfirmation = false;

    if (isRenaming && sessionToRenameIndex !== null) {
      // If renaming to itself, do nothing/close
      if (currentSessions[sessionToRenameIndex].name === name) {
        resetFormState();
        return;
      }
      // If renaming to another existing name
      if (existingIndex !== -1) {
        needsConfirmation = true;
      }
    } else {
      // Logic for New Save: if name exists
      if (existingIndex !== -1) {
        needsConfirmation = true;
      }
    }

    // Define the action to take
    const action = async () => {
      if (isRenaming) {
        await performRename(name);
      } else {
        await handleSaveSession(name);
        resetFormState(); // explicitly close/reset after save
      }
    };

    if (needsConfirmation) {
      const messageContainer = document.createElement("p");
      messageContainer.appendChild(
        document.createTextNode("A session with the name ")
      );

      const boldName = document.createElement("span");
      boldName.className = "font-bold";
      boldName.textContent = name;
      messageContainer.appendChild(boldName);

      messageContainer.appendChild(
        document.createTextNode(" already exists. Do you want to replace it?")
      );

      modal.show("Session Exists", messageContainer, "Replace", action, true);
      return;
    }

    // No conflict, proceed immediately
    await action();
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
      inputField.show();
    });
  }

  // Input Field Callbacks
  inputField.setOnConfirm(handleSessionSubmission);
  inputField.setOnCancel(resetFormState);
});
