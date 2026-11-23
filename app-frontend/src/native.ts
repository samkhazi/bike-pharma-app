import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

export const isNative = Capacitor.isNativePlatform();
const platform = Capacitor.getPlatform();

export function prepareSystemBars() {
  if (platform === "android") StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
}

export function hideLaunchScreen() {
  if (isNative) SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {});
}

export function setStatusBarDark(dark: boolean) {
  if (isNative) StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
}

export function onHardwareBack(handler: () => void) {
  if (!isNative) return () => {};
  const listener = App.addListener("backButton", handler);
  return () => {
    listener.then((sub) => sub.remove());
  };
}

export function leaveApp() {
  App.minimizeApp().catch(() => App.exitApp());
}

/** Picker-style ticks: call start when a drag begins, tick on every step, end when it lets go. */
export const haptic = {
  start() {
    if (isNative) Haptics.selectionStart().catch(() => {});
  },
  tick() {
    if (isNative) Haptics.selectionChanged().catch(() => {});
  },
  end() {
    if (isNative) Haptics.selectionEnd().catch(() => {});
  },
  /** One tick on its own, for switching tabs or pages. */
  select() {
    if (!isNative) return;
    Haptics.selectionStart()
      .then(() => Haptics.selectionChanged())
      .then(() => Haptics.selectionEnd())
      .catch(() => {});
  },
  tap() {
    if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  edge() {
    if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  done() {
    if (isNative) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  },
};

export function hasOverlay() {
  return document.querySelector('[role="dialog"], [role="alertdialog"]') !== null;
}

/** Closes the top sheet, dialog or viewer the same way the Escape key does. */
export function closeOverlay() {
  if (!hasOverlay()) return false;
  const target = document.activeElement ?? document.body;
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
  return true;
}

export const store = {
  get(key: string) {
    try {
      return window.localStorage.getItem(`bs.${key}`);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(`bs.${key}`, value);
    } catch {
      // Storage can be unavailable; the app still works for this session.
    }
  },
};
