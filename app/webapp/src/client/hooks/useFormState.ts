import { useState, useEffect, useRef } from "react";
import { Path, UseFormReturn } from "react-hook-form";
import { StatusType } from "@/client/utils";

// Helper to check for nullish values (null, undefined, or empty string)
const isNullish = (value: unknown): boolean =>
  value === null || value === undefined || value === "";

// Better typed deep equality function
function deepEqual(a: unknown, b: unknown): boolean {
  // Handle primitive types and references
  if (a === b) return true;

  // Handle null/undefined/empty string as equivalent
  if (isNullish(a) && isNullish(b)) return true;

  // If only one is nullish, they're different
  if (isNullish(a) || isNullish(b)) return false;

  // Handle dates
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }

    return true;
  }

  // Handle objects (but not null, which is handled above)
  if (
    typeof a === "object" &&
    a !== null &&
    typeof b === "object" &&
    b !== null
  ) {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (
        !deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      )
        return false;
    }

    return true;
  }

  // Handle different types or other cases
  return false;
}

export function useFormState<T extends Record<string, unknown>>(
  form: UseFormReturn<T>,
  watchFields: (keyof T)[],
  originalData: T
) {
  const [status, setStatus] = useState<StatusType>("none");

  // Store the last values
  const lastValues = useRef<Record<string, unknown>>({});

  // Initialize the lastValues on first render
  useEffect(() => {
    // Only initialize if it's empty
    if (Object.keys(lastValues.current).length === 0) {
      watchFields.forEach((field) => {
        const fieldPath = field as Path<T>;
        // Get value from form (or fall back to originalData)
        const value = form.getValues(fieldPath) ?? originalData[field];
        lastValues.current[field as string] = value;
      });
    }
  }, [form, watchFields, originalData]);

  // Watch for changes in the specified fields
  const values = watchFields.map((field) => form.watch(field as Path<T>));

  // Check for changes using our deep equality function
  const hasChanges = () => {
    return watchFields.some((field) => {
      const currentValue = form.getValues(field as Path<T>);
      const lastValue = lastValues.current[field as string];

      // Use our improved deep equality function
      return !deepEqual(currentValue, lastValue);
    });
  };

  // Update status when form values change
  useEffect(() => {
    if (status === "none") return;

    if (hasChanges()) {
      setStatus("changed");
    }
  }, [...values]);

  const updateLastValues = () => {
    // Update the lastAppliedValues with current values
    watchFields.forEach((field) => {
      const value = form.getValues(field as Path<T>);
      lastValues.current[field as string] = value;
    });
  };

  const handleChange = async (actionFn: () => Promise<boolean>) => {
    setStatus("loading");
    try {
      const result = await actionFn();
      if (result) {
        updateLastValues();
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
    handleChange,
    hasChanges,
    resetValues: () => {
      watchFields.forEach((field) => {
        const value = form.getValues(field as Path<T>);
        lastValues.current[field as string] = value;
      });
    },
  };
}
