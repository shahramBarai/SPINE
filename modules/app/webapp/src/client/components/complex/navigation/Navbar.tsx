"use client";

import { Button } from "../../basics/Button";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/16/solid";
import {
  Disclosure,
  DisclosureButton,
  DisclosurePanel,
} from "@headlessui/react";
import { cn } from "@/client/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import UserMenu from "./UserMenu";
import AvatarButton from "./AvatarButton";
import ThemeButton from "./ThemButton";
import Image from "next/image";

type NavbarProps = {
  navigation: { name: string; href: string }[];
};

export default function Navbar({ navigation }: NavbarProps) {
  const { asPath: currentPath } = useRouter();

  return (
    <Disclosure as="div">
      {({ open, close }) => (
        <>
          {/* Navbar raw content */}
          <div className="w-full z-50 h-16 bg-background border-b border-border shadow-xs flex items-center justify-between pr-4">
            {/* Replace with your SVG or logo */}
            <Image
              src="/metropolia-logo.png"
              alt="Logo"
              width={100}
              height={100}
              className="p-4"
            />

            {/* Nav Links */}
            <div className="hidden md:flex gap-6 flex-1 ml-4">
              {navigation.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`relative px-2 py-1 transition-colors ${
                    currentPath === link.href
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-primary"
                  }`}
                >
                  {link.name}
                  {currentPath.startsWith(link.href) && (
                    <span className="absolute left-0 -bottom-3.5 w-full h-0.5 bg-primary rounded"></span>
                  )}
                </Link>
              ))}
            </div>

            {/* Desktop menu button */}
            <div className="hidden md:flex items-center gap-2">
              <ThemeButton />
              <AvatarButton className="hidden md:block" />
            </div>

            {/* Mobile menu button */}
            <DisclosureButton as="div">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open menu"
                className="md:hidden border-1 border-transparent hover:border-primary"
              >
                {open ? (
                  <XMarkIcon className="text-muted-foreground" />
                ) : (
                  <Bars3Icon className="text-muted-foreground" />
                )}
              </Button>
            </DisclosureButton>
          </div>

          {/* Mobile menu */}
          <DisclosurePanel
            as="nav"
            className="md:hidden z-50 shadow-lg fixed bg-background border-b border-border top-16 w-full"
          >
            <div className="py-3">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  className={cn(
                    item.href === currentPath
                      ? "border-primary bg-primary/10 text-primary font-bold"
                      : "border-transparent text-surface-foreground hover:border-foreground/50 hover:bg-surface hover:text-foreground",
                    "block border-l-4 py-2 pl-3 pr-4 text-base"
                  )}
                  href={item.href}
                  aria-current={item.href === currentPath ? "page" : undefined}
                  onClick={() => close()}
                  data-testrole="sb-mobile-navigation-option"
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="border-t border-border pb-3 pt-4">
              <UserMenu onClick={() => close()} />
            </div>
          </DisclosurePanel>
        </>
      )}
    </Disclosure>
  );
}
