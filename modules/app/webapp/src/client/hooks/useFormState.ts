import { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { StatusType } from "@/client/utils";

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
  }, [isDirty]); // Add formValues and status to dependencies

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
    handleSubmit,
  };
}
