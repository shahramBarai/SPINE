import { useState, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { StatusType } from "utils/index";

/**
 * Tracks a property-panel section's save state so its header can show
 * modified/saving/saved. Note this is *not* react-hook-form's `useFormState`
 * (which reports validation state) - it wraps a form's submit in a status
 * machine, and is only used by the pipeline property panel.
 */
export function useFormState<T extends Record<string, unknown>>(
    form: UseFormReturn<T>
) {
    const [status, setStatus] = useState<StatusType>("none");
    const { isDirty } = form.formState;

    useEffect(() => {
        if (isDirty) {
            // Always change to "changed" status when isDirty,
            // regardless of previous status (including "error")
            setStatus("changed");
        } else if (!isDirty && status !== "none") {
            setStatus("success");
        } else {
            setStatus("none");
        }
        // Deliberately keyed on isDirty alone - reacting to `status` here
        // would re-run this on every status change and fight itself.
    }, [isDirty]);

    const handleSubmit = async (
        values: T,
        fn: (values: T) => Promise<boolean>
    ) => {
        setStatus("loading");
        try {
            const result = await fn(values);
            if (result) {
                form.reset(values);
                setStatus("success");
            } else {
                setStatus("error");
            }
            return result;
        } catch {
            setStatus("error");
            return false;
        }
    };

    return {
        status,
        setStatus,
        handleSubmit
    };
}
