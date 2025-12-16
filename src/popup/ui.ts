import type { Session } from "./types.ts";

// Add type for callbacks
type DeleteCallback = (index: number) => void;
type RestoreCallback = (session: Session) => void;
type ReorderCallback = (src: number, dest: number) => void;

export type RenameCallback = (index: number, currentName: string) => void;

export function renderSessions(
  sessions: Session[],
  sessionList: HTMLElement,
  emptyState: HTMLElement | null,
  onDelete: DeleteCallback,
  onRestore: RestoreCallback,
  onReorder: ReorderCallback,
  onInitiateRename: RenameCallback, // Renamed for clarity
  activeSessionName: string | null
) {
  if (!sessionList) return;
  sessionList.innerHTML = "";
  if (sessions.length === 0) {
    if (emptyState) sessionList.appendChild(emptyState);
    return;
  }

  sessions.forEach((session, index) => {
    const isActive = session.name === activeSessionName;
    const item = document.createElement("div");

    // Base classes
    let classes =
      "card-base flex justify-between items-center group relative mb-0.5 transition-all";

    // Active styling (Blue/Neutral)
    if (isActive) {
      classes +=
        " border-blue-200 bg-blue-50 dark:bg-neutral-800 dark:border-neutral-600 ring-1 ring-blue-200 dark:ring-neutral-600";
    } else {
      classes +=
        " hover:border-neutral-300 dark:hover:border-neutral-700 bg-white dark:bg-neutral-900/40";
    }

    item.className = classes;

    // Drag & Drop Attributes
    item.setAttribute("draggable", "true");
    item.dataset.index = index.toString();

    // Drag Events
    item.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", index.toString());
      item.classList.add("opacity-50");
    });

    item.addEventListener("dragend", () => {
      item.classList.remove("opacity-50");
      document
        .querySelectorAll(".card-base")
        .forEach((el) =>
          el.classList.remove("border-blue-300", "dark:border-blue-700")
        );
    });

    item.addEventListener("dragover", (e) => {
      e.preventDefault();
      item.classList.add("border-blue-300", "dark:border-blue-700");
    });

    item.addEventListener("dragleave", () => {
      item.classList.remove("border-blue-300", "dark:border-blue-700");
    });

    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("border-blue-300", "dark:border-blue-700");
      const fromIndex = parseInt(e.dataTransfer?.getData("text/plain") || "-1");
      if (fromIndex >= 0 && fromIndex !== index) {
        onReorder(fromIndex, index);
      }
    });

    // Date Rendering (YYYY/MM/DD hh:mm)
    const dateVal = session.lastUsed || session.timestamp;
    const d = new Date(dateVal);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const dateStr = `${yyyy}/${mm}/${dd} ${hh}:${min}`;

    // Create content structure programmatically to avoid innerHTML warning

    // 1. Drag Handle
    const dragHandle = document.createElement("div");
    dragHandle.className =
      "mr-1.5 text-neutral-300 cursor-grab group-active:cursor-grabbing hover:text-neutral-500 p-0.5";
    dragHandle.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

    // 2. Main content container
    const contentDiv = document.createElement("div");
    contentDiv.className = "flex flex-col flex-1 pl-1 overflow-hidden";

    // 2a. Name Row
    const nameRow = document.createElement("div");
    nameRow.className = "flex items-center";

    const nameClasses = isActive
      ? "font-medium text-blue-700 dark:text-blue-300"
      : "font-normal text-neutral-700 dark:text-neutral-300";

    const nameSpan = document.createElement("span");
    nameSpan.className = `session-name text-xs sm:text-sm select-none truncate ${nameClasses}`;
    nameSpan.textContent = session.name; // Safe assignment

    nameRow.appendChild(nameSpan);

    if (isActive) {
      const indicator = document.createElement("div");
      indicator.className =
        "ml-1 text-blue-500 dark:text-blue-400 flex items-center";
      indicator.title = "Active Session";
      indicator.innerHTML =
        '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      nameRow.appendChild(indicator);
    }

    // 2b. Date Row
    const dateSpan = document.createElement("span");
    dateSpan.className =
      "text-[10px] text-neutral-400 font-mono select-none truncate";
    dateSpan.textContent = `Last used: ${dateStr}`;

    contentDiv.appendChild(nameRow);
    contentDiv.appendChild(dateSpan);

    // 3. Actions container
    const actionsDiv = document.createElement("div");
    actionsDiv.className =
      "flex items-center opacity-0 group-hover:opacity-100 transition-opacity ml-1 pl-1";

    // 3a. Rename Button
    const renameBtn = document.createElement("button");
    renameBtn.className =
      "rename-btn p-1 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-neutral-800 rounded-md transition-all z-10 relative cursor-pointer";
    renameBtn.setAttribute("aria-label", "Rename");
    renameBtn.title = "Rename Session";
    renameBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>';

    // 3b. Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.className =
      "delete-btn p-1 text-neutral-400 hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all z-10 relative cursor-pointer";
    deleteBtn.setAttribute("aria-label", "Delete");
    deleteBtn.title = "Delete Session";
    deleteBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>';

    actionsDiv.appendChild(renameBtn);
    actionsDiv.appendChild(deleteBtn);

    // Assemble Item
    const innerContainer = document.createElement("div");
    innerContainer.className =
      "flex items-center w-full cursor-pointer px-1 py-0.5 rounded-md";
    innerContainer.appendChild(dragHandle);
    innerContainer.appendChild(contentDiv);
    innerContainer.appendChild(actionsDiv);

    item.appendChild(innerContainer);

    // --- Event Listeners ---

    // Restore on main item click
    item.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      // Safety check if clicked inside actions
      if (
        target.closest(".delete-btn") ||
        target.closest(".rename-btn") ||
        target.closest(".cursor-grab")
      )
        return;
      onRestore(session);
    });

    // Delete
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onDelete(index);
    });

    // Rename
    renameBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Invoke callback to open modal
      onInitiateRename(index, session.name);
    });

    sessionList.appendChild(item);
  });
}
