import { MoonIcon } from "@heroicons/react/16/solid";
import { SunIcon } from "@heroicons/react/16/solid";
import { Button } from "components/basics/Button";
import { useTheme } from "hooks/useTheme";

const ThemeButton = () => {
    const { theme, setTheme } = useTheme();

    return (
        <>
            {theme === "dark" ? (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme("light")}
                    className="hover:text-primary"
                    aria-label="Light theme"
                >
                    <SunIcon className="w-6 h-6" />
                </Button>
            ) : (
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setTheme("dark")}
                    className="hover:text-primary"
                    aria-label="Dark theme"
                >
                    <MoonIcon className="w-6 h-6" />
                </Button>
            )}
        </>
    );
};

export default ThemeButton;
