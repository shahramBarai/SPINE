import {
  ChevronDoubleRightIcon,
  ChevronRightIcon,
  HomeIcon,
} from "@heroicons/react/16/solid";
import { cn } from "@/client/utils";
import { Button } from "@/client/components/basics/Button";

interface BreadcrumbItemProps {
  href: string;
  name: string;
  current?: boolean;
  className?: string;
  icon: React.ReactNode;
}

const BreadcrumbItem = ({
  href,
  name,
  current,
  className,
  icon,
}: BreadcrumbItemProps) => (
  <li key={name} className={cn("flex shrink items-center py-0.5", className)}>
    {icon}
    <Button
      variant="ghost"
      className="py-1 sm:py-0.5"
      href={href}
      aria-current={current ? "page" : undefined}
    >
      {name}
    </Button>
  </li>
);

export default function BreadCrumb({
  homeHref,
  pages,
  className,
}: {
  homeHref?: string;
  pages: {
    name: string;
    href: string;
    current?: boolean;
    className?: string;
  }[];
  className?: string;
}) {
  const backPage = pages[pages.length - 2];
  const homeIcon = (
    <HomeIcon
      className="h-5 w-5 flex-shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  );
  const chevronRightIcon = (
    <ChevronRightIcon
      className="h-6 w-6 flex-shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  );
  const chevronDoubleRightIcon = (
    <ChevronDoubleRightIcon
      className="h-6 w-6 flex-shrink-0 text-muted-foreground"
      aria-hidden="true"
    />
  );

  return (
    <>
      <ol
        role="navigation"
        className={cn("hidden max-h-11 md:flex truncate", className)}
        aria-label="Breadcrumb"
      >
        <BreadcrumbItem href={homeHref ?? "/"} name={"Home"} icon={homeIcon} />
        {pages.map((page) => (
          <BreadcrumbItem key={page.href} {...page} icon={chevronRightIcon} />
        ))}
      </ol>
      <ol
        role="navigation"
        className={cn("flex max-h-11 md:hidden truncate", className)}
        aria-label="Breadcrumb"
      >
        {backPage ? (
          <BreadcrumbItem {...backPage} icon={chevronDoubleRightIcon} />
        ) : (
          <BreadcrumbItem
            href={homeHref ?? "/"}
            name={"Home"}
            icon={homeIcon}
          />
        )}
        {pages.map((page) => {
          if (page.current) {
            return (
              <BreadcrumbItem
                key={page.href}
                {...page}
                icon={chevronRightIcon}
              />
            );
          }
        })}
      </ol>
    </>
  );
}
