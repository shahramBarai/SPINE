import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  type ButtonProps as HeadlessButtonProps,
  Button as HeadlessButton,
} from "@headlessui/react";
import { CheckIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/16/solid";
import { cn, StatusType } from "@/client/utils";

// ----------------------- Button -----------------------

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger",
  {
    variants: {
      variant: {
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        primary:
          "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/90",
        danger: "bg-danger text-danger-foreground shadow-xs hover:bg-danger/90",
        "danger-light":
          "bg-danger-light text-danger-light-foreground shadow-xs hover:bg-danger-light/80",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export function Button({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <HeadlessButton
      {...(props as HeadlessButtonProps)}
      className={cn(buttonVariants({ variant, size, className }))}
    >
      <TouchTarget>{children}</TouchTarget>
    </HeadlessButton>
  );
}

// ----------------------- Touch Target -----------------------

export function TouchTarget({ children }: { children: React.ReactNode }) {
  return (
    <>
      <span
        className="absolute left-1/2 top-1/2 size-[max(100%,2.75rem)] -translate-x-1/2 -translate-y-1/2 [@media(pointer:fine)]:hidden"
        aria-hidden="true"
      />
      {children}
    </>
  );
}

// ----------------------- Action Button -----------------------

type ActionButtonProps = {
  DefaultIcon?: typeof CheckIcon;
  status: StatusType;
  disabled?: boolean;
  isLoading?: boolean;
};

export function ActionButton({
  DefaultIcon,
  status,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> &
  ActionButtonProps) {
  const getStateIcon = () => {
    switch (status) {
      case "success":
        return <CheckIcon className="size-4 text-green-500" />;
      case "error":
        return <XMarkIcon className="size-4 text-red-500" />;
      case "loading":
        return <ArrowPathIcon className="size-4 animate-spin" />;
      default:
        return DefaultIcon ? <DefaultIcon className="size-4" /> : null;
    }
  };

  return (
    <Button
      color="secondary"
      disabled={disabled || status !== "changed"}
      {...props}
    >
      {getStateIcon()}
      {children}
    </Button>
  );
}
