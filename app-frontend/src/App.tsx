import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CustomerApp, TestToolsContext, tabScreens, type Experience, type TestTools, type Theme } from "./customer-app";
import { Toaster } from "@/components/ui/sonner";
import { closeOverlay, hasOverlay, hideLaunchScreen, leaveApp, onHardwareBack, prepareSystemBars, setStatusBarDark, store } from "./native";
import "./native.css";

const onboarding = ["Starting page", "Login / Sign up", "OTP", "Create account"];
const roots = ["Home", "Starting page", "Login / Sign up"];
const showTestTools = import.meta.env.VITE_TEST_TOOLS !== "off";
const toastOffset = { top: "calc(env(safe-area-inset-top, 0px) + 8px)" };

/** The screens navigate by name, so the back stack is rebuilt from where each jump lands. */
function nextStack(stack: string[], to: string) {
  if (roots.includes(to)) return [to];
  if (tabScreens.includes(to)) return ["Home", to];
  const at = stack.lastIndexOf(to);
  if (at >= 0) return stack.slice(0, at + 1);
  return [...stack, to];
}

export function App() {
  const [theme, setTheme] = useState<Theme>(() => (store.get("theme") === "dark" ? "dark" : "light"));
  const [experience, setExperience] = useState<Experience>(() => (store.get("experience") === "returning" ? "returning" : "first"));
  const [stack, setStack] = useState<string[]>(() => [store.get("signedIn") === "yes" ? "Home" : "Starting page"]);
  const screen = stack[stack.length - 1];
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const open = useCallback((to: string) => setStack((current) => nextStack(current, to)), []);

  const back = useCallback(() => {
    if (closeOverlay()) return;
    const current = stackRef.current;
    if (current.length > 1) setStack(current.slice(0, -1));
    else leaveApp();
  }, []);

  useEffect(() => {
    prepareSystemBars();
    hideLaunchScreen();
  }, []);

  useEffect(() => onHardwareBack(back), [back]);

  useEffect(() => {
    if (!onboarding.includes(screen)) store.set("signedIn", "yes");
    else if (screen === "Starting page") {
      store.set("signedIn", "no");
      store.set("experience", "first");
      setExperience("first");
    }
  }, [screen]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    store.set("theme", theme);
  }, [theme]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setStatusBarDark(theme === "dark" || document.querySelector(".cx-phone.night") !== null));
    return () => cancelAnimationFrame(id);
  }, [screen, theme]);

  const pickExperience = useCallback((next: Experience) => {
    setExperience(next);
    store.set("experience", next);
  }, []);

  const testTools = useMemo<TestTools | null>(
    () =>
      showTestTools
        ? {
            experience,
            setExperience: pickExperience,
            restart: () => {
              store.set("signedIn", "no");
              pickExperience("first");
              setStack(["Starting page"]);
            },
          }
        : null,
    [experience, pickExperience],
  );

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    const onPager = (event.target as Element).closest?.("[data-swipe-pager]");
    const fromEdge = event.touches.length === 1 && touch.clientX < 24 && !onPager;
    swipe.current = fromEdge && stackRef.current.length > 1 && !hasOverlay() ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (touch.clientX - start.x > 72 && Math.abs(touch.clientY - start.y) < 60) back();
  };

  return (
    <div className="app-root" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <TestToolsContext.Provider value={testTools}>
        <CustomerApp screen={screen} open={open} experience={experience} theme={theme} setTheme={setTheme} />
      </TestToolsContext.Provider>
      <Toaster position="top-center" theme={theme} offset={toastOffset} mobileOffset={toastOffset} />
    </div>
  );
}
