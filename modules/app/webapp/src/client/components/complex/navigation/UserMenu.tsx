import { useRouter } from "next/router";
import { Avatar } from "@/client/components/basics/Avatar";
import { cn } from "@/client/utils";
import Link from "next/link";
import ThemeButton from "./ThemButton";
import { useAuth } from "@/client/context/AuthProvider";

type UserMenuProps = {
  onClick: () => void;
};

export default function UserMenu({ onClick }: UserMenuProps) {
  const { user, signOut } = useAuth();
  const { asPath: currentPath } = useRouter();

  if (user) {
    return (
      <>
        <div className="flex items-center px-5">
          <div className="flex-shrink-0 text-foreground/70">
            <Avatar src={""} alt={user.email} />
          </div>
          <div className="ml-3">
            <div className="text-base font-medium text-foreground/90">
              {user.email}
            </div>
          </div>
          <div className="ml-auto">
            <ThemeButton />
          </div>
        </div>
        <div className="mt-3 space-y-1 px-5">
          <button
            className="block w-full text-left hover:text-primary hover:cursor-pointer"
            onClick={() => {
              signOut();
              onClick();
            }}
          >
            Sign out
          </button>
        </div>
      </>
    );
  }

  return (
    <Link
      href="/auth"
      className={cn(
        currentPath === "/auth"
          ? "border-elec-purple-500 bg-elec-purple-50 text-elec-purple-700 font-bold"
          : "border-transparent text-foreground hover:border-border hover:bg-surface hover:text-foreground/90",
        "block border-l-4 py-2 pl-3 pr-4 text-base font-medium"
      )}
      aria-current={currentPath === "/auth" ? "page" : undefined}
      onClick={() => onClick()}
      data-testrole="sb-mobile-navigation-option"
    >
      Sign in
    </Link>
  );
}
