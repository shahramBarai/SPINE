import {
    ChevronDoubleRightIcon,
    ChevronRightIcon,
    HomeIcon
} from "@heroicons/react/16/solid";
import { cn } from "utils/index";
import { Button } from "components/basics/Button";

interface Page {
    name: string;
    href: string;
    current?: boolean;
    className?: string;
}

interface BreadcrumbItemProps extends Page {
    icon: React.ReactNode;
}

const BreadcrumbItem = ({
    href,
    name,
    current,
    className,
    icon
}: BreadcrumbItemProps) => (
    <li className={cn("flex shrink items-center py-0.5", className)}>
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

/**
 * Two trails in one: the full path on md and up, and a collapsed
 * back-link + current-page pair on narrow screens.
 */
function BreadCrumb({
    homeHref,
    pages,
    className
}: {
    homeHref?: string;
    pages: Page[];
    className?: string;
}) {
    const backPage = pages[pages.length - 2];

    const homeIcon = (
        <HomeIcon
            className="h-5 w-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
        />
    );
    const chevronRightIcon = (
        <ChevronRightIcon
            className="h-6 w-6 shrink-0 text-muted-foreground"
            aria-hidden="true"
        />
    );
    const chevronDoubleRightIcon = (
        <ChevronDoubleRightIcon
            className="h-6 w-6 shrink-0 text-muted-foreground"
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
                <BreadcrumbItem
                    href={homeHref ?? "/"}
                    name="Home"
                    icon={homeIcon}
                />
                {pages.map((page) => (
                    <BreadcrumbItem
                        key={page.href}
                        {...page}
                        icon={chevronRightIcon}
                    />
                ))}
            </ol>
            <ol
                role="navigation"
                className={cn("flex max-h-11 md:hidden truncate", className)}
                aria-label="Breadcrumb"
            >
                {backPage ? (
                    <BreadcrumbItem
                        {...backPage}
                        icon={chevronDoubleRightIcon}
                    />
                ) : (
                    <BreadcrumbItem
                        href={homeHref ?? "/"}
                        name="Home"
                        icon={homeIcon}
                    />
                )}
                {pages.map((page) =>
                    page.current ? (
                        <BreadcrumbItem
                            key={page.href}
                            {...page}
                            icon={chevronRightIcon}
                        />
                    ) : null
                )}
            </ol>
        </>
    );
}

export { BreadCrumb };
