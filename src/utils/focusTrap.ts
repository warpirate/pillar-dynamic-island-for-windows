/**
 * Focus trap utility for modal dialogs
 * Traps focus within a container element and restores focus on unmount
 */

export interface FocusTrapOptions {
  /** Element to trap focus within */
  container: HTMLElement;
  /** Element to restore focus to when trap is released */
  restoreFocus?: HTMLElement | null;
  /** Whether to focus the first element immediately */
  initialFocus?: boolean;
}

export class FocusTrap {
  private container: HTMLElement;
  private restoreFocus: HTMLElement | null;
  private handleKeyDown: (e: KeyboardEvent) => void;
  private previouslyFocused: HTMLElement | null;

  constructor({ container, restoreFocus = null, initialFocus = true }: FocusTrapOptions) {
    this.container = container;
    this.restoreFocus = restoreFocus;
    this.previouslyFocused = document.activeElement as HTMLElement;

    // Handle Tab key to trap focus
    this.handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusableElements = this.getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab: going backwards
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: going forwards
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener("keydown", this.handleKeyDown);

    if (initialFocus) {
      // Focus first focusable element
      const focusableElements = this.getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        container.focus();
      }
    }
  }

  private getFocusableElements(): HTMLElement[] {
    const selector = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    return Array.from(this.container.querySelectorAll<HTMLElement>(selector)).filter(
      (el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && !el.hasAttribute("aria-hidden");
      }
    );
  }

  release(): void {
    this.container.removeEventListener("keydown", this.handleKeyDown);
    
    // Restore focus
    const target = this.restoreFocus || this.previouslyFocused;
    if (target && document.contains(target)) {
      target.focus();
    }
  }
}

/**
 * Hook-friendly focus trap that returns a cleanup function
 */
export function createFocusTrap(options: FocusTrapOptions): () => void {
  const trap = new FocusTrap(options);
  return () => trap.release();
}
