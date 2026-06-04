import {
    Description,
    Dialog,
    DialogPanel,
    DialogTitle
} from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/16/solid";

import { Button } from "../basics/Button";

function Modal({
    title,
    description,
    children,
    open,
    setOpen
}: {
    title: string;
    description?: string;
    children: React.ReactNode;
    open: boolean;
    setOpen: (open: boolean) => void;
}) {
    return (
        <Dialog
            open={open}
            transition
            className="bg-foreground/20 fixed inset-0 z-50 flex w-screen items-center justify-center p-4 transition duration-300 ease-out data-closed:opacity-0"
            onClose={setOpen}
        >
            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center sm:items-center sm:p-0">
                    <DialogPanel
                        transition
                        className="bg-background relative w-full transform overflow-hidden rounded-lg p-4 pt-6 text-left shadow-xl transition-all duration-300 ease-out data-closed:translate-y-4 data-closed:opacity-0 sm:my-8 sm:max-w-lg sm:p-6 data-closed:sm:translate-y-0 data-closed:sm:scale-95"
                    >
                        <div className="absolute top-0 right-0 block pt-4 pr-4">
                            <Button
                                variant="ghost"
                                type="button"
                                onClick={() => setOpen(false)}
                            >
                                <span className="sr-only">Close</span>
                                <XMarkIcon
                                    className="h-5! w-5!"
                                    aria-hidden="true"
                                />
                            </Button>
                        </div>
                        <DialogTitle
                            as="h3"
                            className="text-foreground text-lg leading-6 font-medium"
                        >
                            {title}
                        </DialogTitle>
                        {description && (
                            <Description
                                as="p"
                                className="text-muted-foreground mt-2 text-sm"
                            >
                                {description}
                            </Description>
                        )}
                        <div className="mt-4">{children}</div>
                    </DialogPanel>
                </div>
            </div>
        </Dialog>
    );
}

export { Modal };
