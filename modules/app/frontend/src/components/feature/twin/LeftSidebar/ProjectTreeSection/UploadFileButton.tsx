import { CloudUpload, FolderOpen } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { cn } from "utils/index";

interface UploadFileButtonProps<T> {
    allowedFileTypes?: string[];
    maxFileSizeMB?: number;
    /** Builds the backend URL to PUT the file to - synchronous, since the
     * backend mints any id it needs itself once the upload lands. */
    buildUploadUrl: (fileName: string) => string;
    onUploadSuccess?: (result: T) => void;
    onUploadError?: (error: Error) => void;
}

// PUTs straight to the backend (which streams the body into MinIO itself -
// it never hands out a URL for MinIO directly), using XMLHttpRequest rather
// than fetch: XHR still streams the file from disk without buffering it in
// JS memory, but unlike fetch it also fires upload progress events, which
// is the only way to get a real byte-level progress bar.
function putFileWithProgress(
    url: string,
    file: File,
    onProgress: (fraction: number) => void
): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", url, true);
        xhr.withCredentials = true;

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress(event.loaded / event.total);
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(
                        xhr.responseText
                            ? JSON.parse(xhr.responseText)
                            : undefined
                    );
                } catch {
                    resolve(undefined);
                }
                return;
            }
            reject(new Error(`Upload failed with status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Upload failed"));

        xhr.send(file);
    });
}

function UploadFileButton<T = unknown>({
    allowedFileTypes,
    maxFileSizeMB,
    buildUploadUrl,
    onUploadSuccess,
    onUploadError
}: UploadFileButtonProps<T>) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [progress, setProgress] = useState<number | null>(null);
    const isUploading = progress !== null;

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
            setProgress(0);

            const result = await putFileWithProgress(
                buildUploadUrl(file.name),
                file,
                setProgress
            );

            toast.success(`${file.name} uploaded successfully.`);
            onUploadSuccess?.(result as T);
        } catch (error) {
            console.error(error);
            const err =
                error instanceof Error
                    ? error
                    : new Error("Upload pipeline failed: Unknown error");
            toast.error(`Failed to upload ${file.name}: ${err.message}`);
            onUploadError?.(err);
        } finally {
            setProgress(null);
            if (fileInputRef.current) fileInputRef.current.value = ""; // reset picker input
        }
    };

    const acceptedFileTypes = allowedFileTypes?.join(",") || "*";
    const progressPercent = Math.round((progress ?? 0) * 100);

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
                    "group relative h-6 px-2 gap-1 rounded flex items-center overflow-hidden transition-all text-muted-foreground",
                    isUploading
                        ? "text-success bg-success/10 cursor-not-allowed"
                        : "hover:cursor-pointer hover:text-foreground hover:bg-accent"
                )}
                aria-label="Upload file"
                title="Upload file"
                disabled={isUploading}
            >
                {isUploading && (
                    <span
                        aria-hidden="true"
                        className="absolute inset-y-0 left-0 bg-success/25 transition-[width] duration-150 ease-out"
                        style={{ width: `${progressPercent}%` }}
                    />
                )}
                {isUploading ? (
                    <>
                        <CloudUpload className="relative z-10 h-3.5 w-3.5 animate-pulse" />
                        <span className="relative z-10 max-w-12 whitespace-nowrap text-[10px] font-medium tabular-nums">
                            {progressPercent}%
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
