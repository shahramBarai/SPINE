import { ReactNode } from "react";
import { cn } from "@/client/utils";
import { Skeleton } from "@/client/components/basics/Skeleton";

interface TitledCardProps {
  title: string;
  isLoading?: boolean;
  className?: string;
  children: ReactNode;
}

function TitledCard({
  title,
  isLoading = false,
  className,
  children,
}: TitledCardProps) {
  const cardClasses = cn(
    "bg-background rounded-lg shadow-sm min-w-[220px]",
    "hover:shadow-md hover:bg-muted transition-shadow duration-200",
    "flex flex-col p-6 gap-1",
    className
  );

  if (isLoading) {
    return (
      <div className={cardClasses}>
        <Skeleton className="h-5 mb-2" />
        <Skeleton className="h-[46px] w-full" />
      </div>
    );
  }

  return (
    <div className={cardClasses}>
      <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
      {children}
    </div>
  );
}

export { TitledCard };
