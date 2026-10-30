export interface ExitConfirmationState {
  isOpen: boolean;
  wasPausedBeforeOpen: boolean;
}

export interface ExitConfirmationCallbacks {
  onPauseGame: () => void;
  onResumeGame: () => void;
  onExitConfirmed: () => void;
  onVisibilityChange: (visible: boolean) => void;
}

export class ExitConfirmationController {
  private callbacks: ExitConfirmationCallbacks;
  private state: ExitConfirmationState = {
    isOpen: false,
    wasPausedBeforeOpen: false,
  };

  constructor(callbacks: ExitConfirmationCallbacks) {
    this.callbacks = callbacks;
  }

  get isOpen(): boolean {
    return this.state.isOpen;
  }

  get wasPausedBeforeOpen(): boolean {
    return this.state.wasPausedBeforeOpen;
  }

  requestExit(isPlaying: boolean, isPaused: boolean): void {
    if (this.state.isOpen) {
      this.cancel();
      return;
    }

    this.state = {
      isOpen: true,
      wasPausedBeforeOpen: isPaused,
    };

    if (isPlaying && !isPaused) {
      this.callbacks.onPauseGame();
    }

    this.callbacks.onVisibilityChange(true);
  }

  cancel(): void {
    if (!this.state.isOpen) return;

    const wasPaused = this.state.wasPausedBeforeOpen;
    this.state.isOpen = false;
    this.callbacks.onVisibilityChange(false);

    if (!wasPaused) {
      this.callbacks.onResumeGame();
    }
  }

  confirm(): void {
    this.state.isOpen = false;
    this.callbacks.onVisibilityChange(false);
    this.callbacks.onExitConfirmed();
  }

  reset(): void {
    if (this.state.isOpen) {
      this.state.isOpen = false;
      this.callbacks.onVisibilityChange(false);
    }
  }
}
