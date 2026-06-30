import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ThemeContextType = {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        const storedTheme = localStorage.getItem("theme") as Theme | null;
        if (storedTheme) {
            // Apply the class immediately to avoid rendering delays
            document.documentElement.classList.toggle(
                "dark",
                storedTheme === "dark"
            );
            return storedTheme;
        }
        return "light";
    });

    // Save theme to localStorage on change
    useEffect(() => {
        localStorage.setItem("theme", theme);
        // Optionally, update <html> class for Tailwind dark mode
        document.documentElement.classList.toggle("dark", theme === "dark");
    }, [theme]);

    const setTheme = (t: Theme) => setThemeState(t);
    const toggleTheme = () =>
        setThemeState((prev) => (prev === "light" ? "dark" : "light"));

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
    return ctx;
}

export { ThemeProvider, useTheme };
