/// <reference types="chrome"/>
import type { Session, StorageData } from "./types";

export async function getDomain(tab: chrome.tabs.Tab): Promise<string | null> {
  if (!tab.url) return null;
  const url = new URL(tab.url);
  return url.host; // Key by host (e.g. localhost:3000)
}

export async function loadSessions(domain: string): Promise<Session[]> {
  const data = await chrome.storage.local.get(domain);
  const domainData = data[domain] as StorageData | undefined;
  return domainData?.sessions || [];
}

export async function saveSessionToStorage(domain: string, session: Session) {
  const sessions = await loadSessions(domain);
  sessions.push(session);
  await chrome.storage.local.set({ [domain]: { sessions } });
}

export async function updateSessionsInStorage(
  domain: string,
  sessions: Session[]
) {
  await chrome.storage.local.set({ [domain]: { sessions } });
}

export async function getActiveSession(domain: string): Promise<string | null> {
  const data = await chrome.storage.local.get(`${domain}_active`);
  return (data[`${domain}_active`] as string) || null;
}

export async function setActiveSession(
  domain: string,
  sessionName: string | null
) {
  if (sessionName === null) {
    await chrome.storage.local.remove(`${domain}_active`);
  } else {
    await chrome.storage.local.set({ [`${domain}_active`]: sessionName });
  }
}

export async function captureLocalStorage(
  tabId: number
): Promise<Record<string, string>> {
  let localStorageData: Record<string, string> = {};
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return JSON.stringify(window.localStorage);
      },
    });
    if (result && result[0] && result[0].result) {
      localStorageData = JSON.parse(result[0].result);
    }
  } catch (e) {
    console.warn("Failed to capture local storage:", e);
  }
  return localStorageData;
}

export async function restoreStorage(
  tabId: number,
  data: Record<string, string>
) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (data) => {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();

          // Restore items
          for (const [key, value] of Object.entries(data)) {
            window.localStorage.setItem(key, value);
          }
          console.log("Storage restored.");
        } catch (e) {
          console.error("Failed to restore storage:", e);
        }
      },
      args: [data],
    });
  } catch (e) {
    console.warn("Scripting permission might be missing:", e);
  }
}

export async function clearStorage(tabId: number) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          window.localStorage.clear();
          window.sessionStorage.clear();
          console.log("Local and Session storage cleared.");
        } catch (e) {
          console.error("Failed to clear storage:", e);
        }
      },
    });
  } catch (e) {
    console.warn(
      "Scripting permission might be missing or failed to execute:",
      e
    );
  }
}
