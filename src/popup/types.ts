/// <reference types="chrome"/>

export interface Session {
  name: string;
  timestamp: number;
  lastUsed?: number;
  cookies: chrome.cookies.Cookie[];
  localStorage?: Record<string, string>;
}

export interface StorageData {
  sessions: Session[];
}
