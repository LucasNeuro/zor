type LogoutOverlayHandlers = {
  beginLogout: () => void;
  endLogout: () => void;
};

let handlers: LogoutOverlayHandlers | null = null;

/** Regista handlers React (provider) para código não-React (auth bridge). */
export function registerLogoutOverlayHandlers(next: LogoutOverlayHandlers | null) {
  handlers = next;
}

/** Dispara overlay de saída a partir de módulos sem acesso ao React context. */
export function beginLogoutFromBridge(): void {
  handlers?.beginLogout();
}

export function endLogoutFromBridge(): void {
  handlers?.endLogout();
}
