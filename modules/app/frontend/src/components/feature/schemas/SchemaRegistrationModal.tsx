import { useState } from "react";
import { useForm } from "react-hook-form";
import {
    DocumentArrowUpIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import type { SchemaType } from "@server/clients/schemaRegistryClient";
import { api } from "utils/trpc";
import { cn } from "utils/index";
import { Button } from "components/basics/Button";
import { Input } from "components/basics/input";
import { Label } from "components/basics/label";
import { Textarea } from "components/basics/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "components/basics/select";
import { Modal } from "components/complex/Modal";

interface SchemaRegistrationForm {
    subject: string;
    schemaType: SchemaType;
    schema: string;
}

interface SchemaRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const EMPTY_FORM: SchemaRegistrationForm = {
    subject: "",
    schemaType: "AVRO",
    schema: ""
};

/** Maps an uploaded file's extension onto the schema type it implies. */
const EXTENSION_TYPES: Record<string, SchemaType> = {
    avsc: "AVRO",
    json: "JSON",
    proto: "PROTOBUF"
};

function SchemaRegistrationModal({
    isOpen,
    onClose,
    onSuccess
}: SchemaRegistrationModalProps) {
    const [validationResult, setValidationResult] = useState<{
        isValid: boolean;
        error?: string;
    } | null>(null);

    const {
        register,
        handleSubmit,
        watch,
        setValue,
        reset,
        formState: { errors }
    } = useForm<SchemaRegistrationForm>({ defaultValues: EMPTY_FORM });

    const watchedSchema = watch("schema");
    const watchedSchemaType = watch("schemaType");

    const registerSchemaMutation =
        api.schemaRegistry.registerSchema.useMutation({
            onSuccess: () => {
                reset(EMPTY_FORM);
                setValidationResult(null);
                onSuccess();
            }
        });

    // Fetched on demand from the Validate button rather than on every
    // keystroke, hence enabled: false + refetch().
    const validateSchemaQuery = api.schemaRegistry.validateSchema.useQuery(
        { schema: watchedSchema || "", schemaType: watchedSchemaType },
        { enabled: false }
    );

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setValue("schema", e.target?.result as string);

            const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
            if (EXTENSION_TYPES[extension]) {
                setValue("schemaType", EXTENSION_TYPES[extension]);
            }

            if (!watch("subject")) {
                setValue(
                    "subject",
                    file.name.replace(/\.(avsc|json|proto)$/, "")
                );
            }
        };
        reader.readAsText(file);
    };

    const handleValidate = async () => {
        if (!watchedSchema) return;

        const result = await validateSchemaQuery.refetch();

        if (result.data) {
            setValidationResult({ isValid: result.data.isValid });
        } else {
            setValidationResult({
                isValid: false,
                error: result.error?.message ?? "Validation failed"
            });
        }
    };

    const onSubmit = (data: SchemaRegistrationForm) => {
        registerSchemaMutation.mutate(data);
    };

    const handleClose = () => {
        reset(EMPTY_FORM);
        setValidationResult(null);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <Modal
            title="Register New Schema"
            description="Register a new schema to the schema registry"
            open={isOpen}
            setOpen={onClose}
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Basic Information */}
                <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-start">
                    <div className="flex-1">
                        <Label htmlFor="subject">Subject Name *</Label>
                        <Input
                            id="subject"
                            {...register("subject", {
                                required: "Subject name is required",
                                pattern: {
                                    value: /^[a-zA-Z0-9._-]+$/,
                                    message:
                                        "Subject name can only contain letters, numbers, dots, underscores, and hyphens"
                                }
                            })}
                            placeholder="e.g., sensor-data-value"
                            aria-invalid={!!errors.subject}
                        />
                        {errors.subject && (
                            <p className="text-danger text-sm mt-1">
                                {errors.subject.message}
                            </p>
                        )}
                    </div>

                    <div>
                        <Label htmlFor="schemaType">Schema Type *</Label>
                        <Select
                            value={watchedSchemaType}
                            onValueChange={(value) =>
                                setValue("schemaType", value as SchemaType)
                            }
                        >
                            <SelectTrigger id="schemaType">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="AVRO">AVRO</SelectItem>
                                <SelectItem value="JSON">
                                    JSON Schema
                                </SelectItem>
                                <SelectItem value="PROTOBUF">
                                    Protocol Buffers
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* File Upload */}
                <div>
                    <Label>Upload Schema File</Label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-border border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-muted-foreground" />
                            <div className="flex text-sm text-muted-foreground">
                                <label className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80">
                                    <span>Upload a file</span>
                                    <input
                                        type="file"
                                        className="sr-only"
                                        accept=".avsc,.json,.proto"
                                        onChange={handleFileUpload}
                                    />
                                </label>
                                <p className="pl-1">or paste schema below</p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                .avsc, .json, or .proto files up to 10MB
                            </p>
                        </div>
                    </div>
                </div>

                {/* Schema Definition */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="schema">Schema Definition *</Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleValidate}
                            disabled={
                                !watchedSchema || validateSchemaQuery.isFetching
                            }
                        >
                            {validateSchemaQuery.isFetching
                                ? "Validating..."
                                : "Validate Schema"}
                        </Button>
                    </div>

                    <Textarea
                        id="schema"
                        {...register("schema", {
                            required: "Schema definition is required"
                        })}
                        className={cn(
                            "h-64 font-mono resize-none",
                            errors.schema && "border-danger"
                        )}
                        placeholder="Paste your schema definition here..."
                    />

                    {errors.schema && (
                        <p className="text-danger text-sm mt-1">
                            {errors.schema.message}
                        </p>
                    )}

                    {/* Validation Result */}
                    {validationResult && (
                        <div
                            className={cn(
                                "mt-3 p-3 rounded-lg flex items-start space-x-2 border",
                                validationResult.isValid
                                    ? "bg-success-light border-success"
                                    : "bg-danger-light border-danger"
                            )}
                        >
                            {validationResult.isValid ? (
                                <CheckCircleIcon className="h-5 w-5 text-success mt-0.5" />
                            ) : (
                                <ExclamationTriangleIcon className="h-5 w-5 text-danger mt-0.5" />
                            )}
                            <div className="flex-1">
                                <p
                                    className={cn(
                                        "text-sm font-medium",
                                        validationResult.isValid
                                            ? "text-success-light-foreground"
                                            : "text-danger-light-foreground"
                                    )}
                                >
                                    {validationResult.isValid
                                        ? "Schema is valid!"
                                        : "Schema validation failed"}
                                </p>
                                {validationResult.error && (
                                    <p className="text-danger-light-foreground text-sm mt-1">
                                        {validationResult.error}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Error Display */}
                {registerSchemaMutation.error && (
                    <div className="bg-danger-light border border-danger rounded-lg p-4">
                        <div className="flex items-start space-x-2">
                            <ExclamationTriangleIcon className="h-5 w-5 text-danger mt-0.5" />
                            <div>
                                <h4 className="text-sm font-medium text-danger-light-foreground">
                                    Registration Failed
                                </h4>
                                <p className="text-sm text-danger-light-foreground mt-1">
                                    {registerSchemaMutation.error.message}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end space-x-3 pt-6 border-t border-border">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleClose}
                        disabled={registerSchemaMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        disabled={registerSchemaMutation.isPending}
                    >
                        {registerSchemaMutation.isPending
                            ? "Registering..."
                            : "Register Schema"}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export { SchemaRegistrationModal };
