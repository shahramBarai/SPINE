import { cn } from "utils/index";

const CheckButton = ({
    checked,
    onClick,
    disabled = false
}: {
    checked: boolean;
    onClick: () => void;
    disabled?: boolean;
}) => {
    return (
        <input
            type="checkbox"
            checked={checked}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={cn(
                "rounded h-3 w-3",
                checked && "bg-primary/10 text-primary",
                disabled
                    ? "opacity-50 hover:cursor-default"
                    : "hover:cursor-pointer hover:bg-muted/20 transition-all"
            )}
            disabled={disabled}
        />
    );
};

export { CheckButton };
