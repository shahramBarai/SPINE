import { useState } from "react";
import { useForm } from "react-hook-form";
import { api } from "@/utils/trpc";
import { SchemaType } from "@/server/schemas/schema-registry";
import { Button } from "@/client/components/basics/Button";
import { Input } from "@/client/components/basics/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/client/components/basics/select";
import {
  DocumentArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Modal } from "../../complex/Modal";

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

export const SchemaRegistrationModal: React.FC<
  SchemaRegistrationModalProps
> = ({ isOpen, onClose, onSuccess }) => {
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
    formState: { errors },
  } = useForm<SchemaRegistrationForm>({
    defaultValues: {
      schemaType: "AVRO",
      schema: "",
      subject: "",
    },
  });

  const watchedSchema = watch("schema");
  const watchedSchemaType = watch("schemaType");

  const registerSchemaMutation = api.schemaRegistry.registerSchema.useMutation({
    onSuccess: () => {
      reset();
      setValidationResult(null);
      onSuccess();
    },
  });

  const validateSchemaMutation = api.schemaRegistry.validateSchema.useQuery(
    {
      schema: watchedSchema || "",
      schemaType: watchedSchemaType,
    },
    {
      enabled: false,
    }
  );

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setValue("schema", content);

        // Infer schema type from file extension
        if (file.name.endsWith(".avsc")) {
          setValue("schemaType", "AVRO");
        } else if (file.name.endsWith(".json")) {
          setValue("schemaType", "JSON");
        } else if (file.name.endsWith(".proto")) {
          setValue("schemaType", "PROTOBUF");
        }

        // Infer subject name from filename
        const baseName = file.name.replace(/\.(avsc|json|proto)$/, "");
        if (!watch("subject")) {
          setValue("subject", baseName);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleValidate = async () => {
    if (watchedSchema && watchedSchemaType) {
      try {
        const result = await validateSchemaMutation.refetch();
        if (result.data) {
          setValidationResult({ isValid: result.data.isValid });
        }
      } catch (error) {
        setValidationResult({
          isValid: false,
          error: error instanceof Error ? error.message : "Validation failed",
        });
      }
    }
  };

  const onSubmit = async (data: SchemaRegistrationForm) => {
    try {
      await registerSchemaMutation.mutateAsync(data);
    } catch {
      // Error is handled by the mutation
    }
  };

  const handleClose = () => {
    reset();
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
        <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center ">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subject Name *
            </label>
            <Input
              {...register("subject", {
                required: "Subject name is required",
                pattern: {
                  value: /^[a-zA-Z0-9._-]+$/,
                  message:
                    "Subject name can only contain letters, numbers, dots, underscores, and hyphens",
                },
              })}
              placeholder="e.g., sensor-data-value"
              className={errors.subject ? "border-red-500" : ""}
            />
            {errors.subject && (
              <p className="text-red-500 text-sm mt-1">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Schema Type *
            </label>
            <Select
              value={watch("schemaType")}
              onValueChange={(value) =>
                setValue("schemaType", value as SchemaType)
              }
            >
              <SelectTrigger
                className={errors.schemaType ? "border-red-500" : ""}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AVRO">AVRO</SelectItem>
                <SelectItem value="JSON">JSON Schema</SelectItem>
                <SelectItem value="PROTOBUF">Protocol Buffers</SelectItem>
              </SelectContent>
            </Select>
            {errors.schemaType && (
              <p className="text-red-500 text-sm mt-1">
                {errors.schemaType.message}
              </p>
            )}
          </div>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Schema File
          </label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
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
              <p className="text-xs text-gray-500">
                .avsc, .json, or .proto files up to 10MB
              </p>
            </div>
          </div>
        </div>

        {/* Schema Definition */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Schema Definition *
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleValidate}
              disabled={!watchedSchema || validateSchemaMutation.isPending}
            >
              {validateSchemaMutation.isPending
                ? "Validating..."
                : "Validate Schema"}
            </Button>
          </div>

          <textarea
            {...register("schema", {
              required: "Schema definition is required",
            })}
            className={`w-full h-64 p-3 border rounded-md font-mono text-sm resize-none ${
              errors.schema ? "border-red-500" : "border-gray-300"
            }`}
            placeholder="Paste your schema definition here..."
          />

          {errors.schema && (
            <p className="text-red-500 text-sm mt-1">{errors.schema.message}</p>
          )}

          {/* Validation Result */}
          {validationResult && (
            <div
              className={`mt-3 p-3 rounded-lg flex items-start space-x-2 ${
                validationResult.isValid
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              {validationResult.isValid ? (
                <CheckCircleIcon className="h-5 w-5 text-green-500 mt-0.5" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`text-sm font-medium ${
                    validationResult.isValid ? "text-green-800" : "text-red-800"
                  }`}
                >
                  {validationResult.isValid
                    ? "Schema is valid!"
                    : "Schema validation failed"}
                </p>
                {validationResult.error && (
                  <p className="text-red-700 text-sm mt-1">
                    {validationResult.error}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {registerSchemaMutation.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-red-800">
                  Registration Failed
                </h4>
                <p className="text-sm text-red-700 mt-1">
                  {registerSchemaMutation.error.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={registerSchemaMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={registerSchemaMutation.isPending}>
            {registerSchemaMutation.isPending
              ? "Registering..."
              : "Register Schema"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
