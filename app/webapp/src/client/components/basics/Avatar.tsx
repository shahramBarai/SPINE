import { type ComponentPropsWithoutRef, useMemo } from "react";
import { UserIcon } from "@heroicons/react/24/outline";
import { cn } from "@/client/utils";
import Image from "next/image";

// Base props that are common to all avatar variants
interface AvatarBaseProps {
  alt?: string;
  className?: string;
  withCircle?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
}

// Image avatar variant
interface ImageAvatarProps extends AvatarBaseProps {
  src: string | null;
  initials?: never;
}

// Initials avatar variant
interface InitialsAvatarProps extends AvatarBaseProps {
  src?: never;
  initials: string;
}

// Fallback avatar variant (UserIcon)
interface FallbackAvatarProps extends AvatarBaseProps {
  src?: never;
  initials?: never;
}

// Union type of all avatar variants
type AvatarProps = ImageAvatarProps | InitialsAvatarProps | FallbackAvatarProps;

export function Avatar({
  src,
  initials,
  alt = "",
  className,
  size = "md",
  withCircle = false,
  ...props
}: AvatarProps & ComponentPropsWithoutRef<"span">) {
  const sizeClass = useMemo(() => {
    if (typeof size === "number") {
      return `h-[${size}px] w-[${size}px]`;
    }

    const sizeMap = {
      xs: "h-6 w-6 text-xs",
      sm: "h-8 w-8 text-sm",
      md: "h-10 w-10 text-base",
      lg: "h-12 w-12 text-lg",
      xl: "h-16 w-16 text-xl",
    };

    return sizeMap[size];
  }, [size]);

  return (
    <span
      data-slot="avatar"
      {...props}
      className={cn(
        className,
        sizeClass,
        // Basic layout
        "inline-grid overflow-clip shrink-0 align-middle rounded-full *:rounded-full *:col-start-1 *:row-start-1",
        withCircle ? "outline-1 -outline-offset-1" : ""
      )}
    >
      {src ? (
        <Image src={src} alt={alt} width={100} height={100} />
      ) : initials ? (
        <svg
          className="size-full select-none fill-current p-[5%] text-[48px] font-medium uppercase"
          viewBox="0 0 100 100"
          aria-hidden={alt ? undefined : "true"}
        >
          {alt && <title>{alt}</title>}
          <text
            x="50%"
            y="50%"
            alignmentBaseline="middle"
            dominantBaseline="middle"
            textAnchor="middle"
            dy=".125em"
          >
            {initials}
          </text>
        </svg>
      ) : (
        <UserIcon className="w-full h-full p-0.5" />
      )}
    </span>
  );
}
