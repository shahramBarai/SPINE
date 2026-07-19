import { Modal } from "components/complex/Modal";
import { Button } from "components/basics/Button";

interface ConfirmModalProps {
    title: string;
    description?: string;
    open: boolean;
    setOpen: (open: boolean) => void;
    onConfirm: () => void;
    confirmLabel?: string;
    isConfirming?: boolean;
    children?: React.ReactNode;
}

// A reusable "are you sure?" dialog for destructive actions - file/folder
// deletion today, anything else that needs a confirm-before-you-commit step
// later. Extra context (e.g. a list of what else will be deleted) goes in
// `children`.
function ConfirmModal({
    title,
    description,
    open,
    setOpen,
    onConfirm,
    confirmLabel = "Delete",
    isConfirming = false,
    children
}: ConfirmModalProps) {
    return (
        <Modal title={title} description={description} open={open} setOpen={setOpen}>
            <div className="flex flex-col gap-4">
                {children}
                <div className="flex justify-end gap-2">
                    <Button
                        variant="outline"
                        disabled={isConfirming}
                        onClick={() => setOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        disabled={isConfirming}
                        onClick={onConfirm}
                    >
                        {isConfirming ? "Deleting..." : confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

export { ConfirmModal };
