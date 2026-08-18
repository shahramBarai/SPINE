import * as React from "react";

import { cn } from "utils/index";

function Textarea({
    className,
    ...props
}: React.ComponentProps<"textarea">) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                "placeholder:text-muted-foreground border-input flex min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger",
                className
            )}
            {...props}
        />
    );
}

export { Textarea };
