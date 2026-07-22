import { useRef } from "react";
import { ImageIcon, Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { api } from "utils/trpc";
import { Button } from "components/basics/Button";
import { SectionCard } from "components/complex/SectionCard";
import { UploadFileButton } from "components/feature/twin/LeftSidebar/ProjectTreeSection/UploadFileButton";

const ALLOWED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

function CoverImageSection({
    projectId,
    coverImageUrl
}: {
    projectId: string;
    coverImageUrl: string | null;
}) {
    const utils = api.useUtils();
    const uploadedKeyRef = useRef<string | null>(null);

    const getCoverUploadUrl = api.project.getCoverUploadUrl.useMutation();

    const setCoverImage = api.project.setCoverImage.useMutation({
        onSuccess: () => {
            utils.project.getProjectInfo.invalidate({ projectId });
            utils.digitalTwin.getProjects.invalidate();
            toast.success("Cover image updated.");
        },
        onError: (err) => toast.error(err.message)
    });

    const removeCoverImage = api.project.removeCoverImage.useMutation({
        onSuccess: () => {
            utils.project.getProjectInfo.invalidate({ projectId });
            utils.digitalTwin.getProjects.invalidate();
            toast.success("Cover image removed.");
        },
        onError: (err) => toast.error(err.message)
    });

    return (
        <SectionCard title="Cover Image">
            <div className="relative h-40 w-full max-w-sm rounded-lg overflow-hidden border border-border bg-muted">
                {coverImageUrl ? (
                    <img
                        src={coverImageUrl}
                        alt="Project cover"
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                )}

                {removeCoverImage.isPending || setCoverImage.isPending ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                        <UploadFileButton
                            allowedFileTypes={ALLOWED_IMAGE_EXTENSIONS}
                            maxFileSizeMB={10}
                            getUploadUrlString={async (fileName) => {
                                const { uploadUrl, objectKey } =
                                    await getCoverUploadUrl.mutateAsync({
                                        projectId,
                                        fileName
                                    });
                                uploadedKeyRef.current = objectKey;
                                return uploadUrl;
                            }}
                            onUploadSuccess={() => {
                                if (!uploadedKeyRef.current) return;
                                setCoverImage.mutate({
                                    projectId,
                                    objectKey: uploadedKeyRef.current
                                });
                            }}
                        />
                        {coverImageUrl && (
                            <Button
                                variant="ghost"
                                size="icon"
                                title="Remove cover image"
                                onClick={() =>
                                    removeCoverImage.mutate({ projectId })
                                }
                            >
                                <X className="h-4 w-4 text-danger" />
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </SectionCard>
    );
}

export { CoverImageSection };
