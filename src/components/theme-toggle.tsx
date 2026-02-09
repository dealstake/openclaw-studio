"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { HeaderIconButton } from "@/components/HeaderIconButton";

const THEME_STORAGE_KEY = "theme";

type ThemeMode = "light" | "dark";

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
};

const applyTheme = (mode: ThemeMode) => {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", mode === "dark");
};

export const ThemeToggle = () => {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const preferred = getPreferredTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(preferred);
    applyTheme(preferred);
  }, []);

  const toggleTheme = () => {
    setTheme((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, next);
      }
      applyTheme(next);
      return next;
    });
  };

  const isDark = theme === "dark";

  return (
    <HeaderIconButton
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun className="h-[15px] w-[15px]" /> : <Moon className="h-[15px] w-[15px]" />}
    </HeaderIconButton>
  );
};
