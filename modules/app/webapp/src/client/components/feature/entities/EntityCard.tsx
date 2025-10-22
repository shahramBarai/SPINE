import { PhotoIcon } from "@heroicons/react/24/outline";
import { cn } from "@/client/utils";
import Image from "next/image";
import { Skeleton } from "../../basics/Skeleton";
import { EntityType } from "@/server/services/data-service/types";

interface BaseProps {
  imageUrl: string;
  title: string;
  description: string;
  type: EntityType;
  className?: string;
  expandHitArea?: boolean;
}
interface LinkProps extends BaseProps {
  href: string;
  onClick?: never;
}
interface ButtonProps extends BaseProps {
  onClick: () => void;
  href?: never;
}

type EntityCardProps = LinkProps | ButtonProps;

const EntityTypesMap: Record<EntityType, { style: string; text: string }> = {
  DISTRICT: {
    style: "bg-red-100/50 text-red-500 border border-red-300",
    text: "District",
  },
  CAMPUS: {
    style: "bg-blue-100/50 text-blue-500 border border-blue-300",
    text: "Campus",
  },
  BUILDING: {
    style: "bg-green-100/50 text-green-500 border border-green-300",
    text: "Building",
  },
  LAB: {
    style: "bg-purple-100/50 text-purple-500 border border-purple-300",
    text: "Lab",
  }
};

const Badge = ({ type }: { type: EntityType }) => {
  const typeData = EntityTypesMap[type];
  return (
    <div className={cn("text-xs rounded-md px-2 py-1", typeData.style)}>
      {typeData.text}
    </div>
  );
};

function EntityCard({
  imageUrl,
  title,
  description,
  type,
  className,
  onClick,
  href,
}: EntityCardProps) {
  return (
    <div
      className={cn(
        "relative border border-border rounded-lg shadow-sm bg-background overflow-hidden group",
        className
      )}
    >
      {/* Cover Image */}
      <div className="relative h-48">
        {imageUrl ? (
          <Image
            className="absolute inset-0 object-cover w-full h-full"
            src={imageUrl}
            alt="Card image"
            width={1000}
            height={1000}
          />
        ) : (
          <div className="absolute inset-0 bg-muted flex items-center justify-center">
            <PhotoIcon className="w-10 h-10 text-muted-foreground" />
          </div>
        )}
        <div className="absolute inset-0 group-hover:bg-foreground/15 transition-colors duration-300" />
      </div>
      {/* Content */}
      <div className="p-4 w-full group-hover:bg-surface/50 transition-colors duration-300">
        <div className="flex flex-col gap-3">
          {/* Title + Description */}
          <div className="flex flex-col text-left">
            <h2
              className={cn("text-xl font-bold text-foreground truncate mb-1")}
            >
              {title}
            </h2>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {description}
            </p>
          </div>
          {/* Badge */}
          <div className="flex flex-row justify-end items-end">
            <Badge type={type} />
          </div>
        </div>
      </div>
      {/* Expand hit area for button or link */}
      {onClick && (
        <div
          className="absolute inset-0 group-hover:cursor-pointer"
          onClick={onClick}
        />
      )}
      {href && (
        <a
          className="absolute inset-0 group-hover:cursor-pointer"
          href={href}
        />
      )}
    </div>
  );
}

function EntityCardLoading() {
  return (
    <div className="relative border border-border rounded-lg shadow-sm bg-background overflow-hidden group">
      {/* Cover Image */}
      <Skeleton className="h-48 w-full" />
      {/* Content */}
      <div className="p-4 w-full group-hover:bg-surface/50 transition-colors duration-300">
        <div className="flex flex-col gap-3">
          {/* Title + Description */}
          <div className="flex flex-col text-left">
            <Skeleton className="h-7 mb-1" />
            <Skeleton className="h-5" />
          </div>
          {/* Badge */}
          <div className="flex flex-row justify-end items-end">
            <Skeleton className="h-[20px] w-[60px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export { EntityCard, EntityCardLoading };
