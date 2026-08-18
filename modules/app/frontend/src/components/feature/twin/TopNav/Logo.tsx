import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

function Logo() {
    return (
        <Link
            to="/projects"
            title="Back to Projects"
            className="flex items-center gap-2.5 pr-4 border-r border-border/60 h-full hover:opacity-80 transition-opacity"
        >
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            <img
                src="/metropolia-logo.png"
                alt="Metropolia logo"
                className="h-8 w-auto object-contain"
            />
        </Link>
    );
}

export { Logo };
