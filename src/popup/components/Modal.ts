export class Modal {
  private modal: HTMLElement;
  private title: HTMLElement;
  private message: HTMLElement;
  private cancelBtn: HTMLButtonElement;
  private confirmBtn: HTMLButtonElement;
  private pendingAction: (() => Promise<void>) | null = null;

  constructor(
    modalId: string,
    titleId: string,
    messageId: string,
    cancelBtnId: string,
    confirmBtnId: string
  ) {
    this.modal = document.getElementById(modalId) as HTMLElement;
    this.title = document.getElementById(titleId) as HTMLElement;
    this.message = document.getElementById(messageId) as HTMLElement;
    this.cancelBtn = document.getElementById(cancelBtnId) as HTMLButtonElement;
    this.confirmBtn = document.getElementById(
      confirmBtnId
    ) as HTMLButtonElement;

    this.initListeners();
  }

  private initListeners() {
    if (this.cancelBtn) {
      this.cancelBtn.addEventListener("click", () => {
        this.close();
      });
    }

    if (this.confirmBtn) {
      this.confirmBtn.addEventListener("click", async () => {
        if (this.pendingAction) {
          await this.pendingAction();
        }
        this.close();
      });
    }
  }

  public show(
    title: string,
    message: string | HTMLElement,
    confirmLabel: string,
    onConfirm: () => Promise<void>,
    isDestructive = false
  ) {
    if (this.title) this.title.textContent = title;

    if (this.message) {
      if (typeof message === "string") {
        this.message.textContent = message;
      } else if (message instanceof Node) {
        this.message.innerHTML = "";
        this.message.appendChild(message);
      }
    }

    if (this.confirmBtn) {
      this.confirmBtn.textContent = confirmLabel;
      if (isDestructive) {
        this.confirmBtn.classList.remove(
          "bg-blue-500",
          "hover:bg-blue-600",
          "border-blue-500"
        );
        this.confirmBtn.classList.add(
          "bg-red-500",
          "hover:bg-red-600",
          "border-red-500"
        );
      } else {
        this.confirmBtn.classList.remove(
          "bg-red-500",
          "hover:bg-red-600",
          "border-red-500"
        );
        this.confirmBtn.classList.add(
          "bg-blue-500",
          "hover:bg-blue-600",
          "border-blue-500"
        );
      }
    }

    this.pendingAction = onConfirm;
    this.modal.classList.remove("hidden");
    this.modal.classList.add("flex");
  }

  public close() {
    this.modal.classList.add("hidden");
    this.modal.classList.remove("flex");
    this.pendingAction = null;
  }
}
