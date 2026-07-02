import { CloudUpload, FolderOpen } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { cn } from "utils/index";

interface UploadFileButtonProps {
    allowedFileTypes?: string[];
    maxFileSizeMB?: number;
    getUploadUrlString: (fileName: string) => Promise<string>;
    onUploadSuccess?: (fileName: string) => void;
    onUploadError?: (error: Error) => void;
}

function UploadFileButton({
    allowedFileTypes,
    maxFileSizeMB,
    getUploadUrlString,
    onUploadSuccess,
    onUploadError
}: UploadFileButtonProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Optional safety boundary checks
        if (
            allowedFileTypes &&
            !allowedFileTypes.some((type) =>
                file.name.toLowerCase().endsWith(type)
            )
        ) {
            toast.warning(
                `Please select a valid file type: ${allowedFileTypes.join(", ")}`
            );
            return;
        }

        if (maxFileSizeMB && file.size > maxFileSizeMB * 1024 * 1024) {
            toast.warning(
                `File size exceeds the maximum limit of ${maxFileSizeMB} MB`
            );
            return;
        }

        try {
            setIsUploading(true);

            // 1. Fetch pre-signed upload URL from backend
            const uploadUrl = await getUploadUrlString(file.name);

            // 2. Upload file directly to S3 / Cloud Storage bucket
            const uploadResponse = await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": "application/octet-stream"
                }
            });

            // 3. Handle upload response
            if (!uploadResponse.ok) {
                toast.error(`Failed to upload ${file.name}.`);
                onUploadError?.(
                    new Error(
                        `Upload failed with status ${uploadResponse.status}`
                    )
                );
                return;
            }

            toast.success(`${file.name} uploaded successfully.`);
            onUploadSuccess?.(file.name);
        } catch (error) {
            console.error(error);
            if (error instanceof Error) {
                toast.error(
                    `Upload pipeline failed: ${error.message || "Unknown error"}`
                );
                onUploadError?.(error);
            } else {
                toast.error("Upload pipeline failed: Unknown error");
                onUploadError?.(
                    new Error("Upload pipeline failed: Unknown error")
                );
            }
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ""; // reset picker input
        }
    };

    const acceptedFileTypes = allowedFileTypes?.join(",") || "*";

    return (
        <>
            {/* Hidden native input file interface */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept={acceptedFileTypes}
                className="hidden"
                disabled={isUploading}
            />
            <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                    "group h-6 px-2 gap-1 rounded flex items-center transition-all text-muted-foreground",
                    isUploading
                        ? "text-success bg-success/10"
                        : "hover:cursor-pointer hover:text-foreground hover:bg-accent",
                    isUploading && "cursor-not-allowed opacity-50"
                )}
                aria-label="Upload file"
                title="Upload file"
                disabled={isUploading}
            >
                {isUploading ? (
                    <>
                        <CloudUpload className="h-3.5 w-3.5" />
                        <span className="max-w-12 whitespace-nowrap text-[10px] font-medium">
                            Uploading
                        </span>
                    </>
                ) : (
                    <>
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span
                            className={cn(
                                "max-w-0 overflow-hidden whitespace-nowrap opacity-0",
                                "transition-all duration-150",
                                "text-[10px] font-medium truncate",
                                "group-hover:max-w-12 group-hover:opacity-100"
                            )}
                        >
                            Upload
                        </span>
                    </>
                )}
            </button>
        </>
    );
}

export { UploadFileButton };
