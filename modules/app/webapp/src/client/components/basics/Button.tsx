import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonProps as HeadlessButtonProps } from "@headlessui/react";
import { CheckIcon, XMarkIcon, ArrowPathIcon } from "@heroicons/react/16/solid";
import { cn, StatusType } from "@/client/utils";
import Link from "next/link";

// ----------------------- Button -----------------------

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-danger/20 dark:aria-invalid:ring-danger/40 aria-invalid:border-danger cursor-pointer",
  {
    variants: {
      variant: {
        outline: "border bg-background shadow-xs hover:bg-muted",
        ghost: "hover:bg-none hover:text-primary",
        link: "text-primary underline-offset-4 hover:underline",
        primary:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90",
        danger: "bg-danger text-danger-foreground shadow-sm hover:bg-danger/90",
        "danger-light":
          "bg-danger-light text-danger-light-foreground shadow-sm hover:bg-danger-light/80",
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

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  href?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, href, ...props }, ref) => {
    if (href) {
      return (
        <Link
          href={href}
          className={cn(buttonVariants({ variant, size }), className)}
        >
          <TouchTarget>{children}</TouchTarget>
        </Link>
      );
    }

    return (
      <button
        {...(props as HeadlessButtonProps)}
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
      >
        <TouchTarget>{children}</TouchTarget>
      </button>
    );
  }
);

Button.displayName = "Button";

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
