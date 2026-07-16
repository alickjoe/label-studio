import { z } from "zod";
import type { FieldDefinition } from "./types/common";
import { getProviderConfig } from "./providers";
import { assembleSchema } from "./types/provider";

// Step validation schemas
export const step1Schema = z.object({
  provider: z.string().min(1, "请选择存储提供商"),
});

// Helper function to get provider-specific schema
export const getProviderSchema = (provider: string, isEditMode = false, target?: "import" | "export") => {
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig) {
    return z.object({}); // Empty schema for unknown providers
  }

  // Combine provider-specific fields with common fields like title
  const commonFields: FieldDefinition[] = [
    {
      name: "title",
      type: "text",
      label: "存储标题",
      required: true,
      schema: z.string().min(1, "存储标题为必填项"),
    },
  ];

  // Add export-specific common fields
  const exportFields: FieldDefinition[] =
    target === "export"
      ? [
          {
            name: "can_delete_objects",
            type: "toggle",
            label: "可以从存储中删除对象",
            description: "如果未勾选，标注将不会从存储中删除",
            schema: z.boolean().default(false),
          },
        ]
      : [];

  // Filter out message fields and combine with common fields
  const providerFields = providerConfig.fields.filter(
    (field): field is FieldDefinition => "type" in field && field.type !== "message",
  );

  // Filter fields based on target if specified
  const filteredProviderFields = target
    ? providerFields.filter((field) => !field.target || field.target === target)
    : providerFields;

  const allFields = [...commonFields, ...exportFields, ...filteredProviderFields];
  return assembleSchema(allFields, isEditMode);
};

// Helper function to format validation errors in human-friendly format
export const formatValidationErrors = (zodError: z.ZodError): Record<string, string> => {
  const errors: Record<string, string> = {};

  zodError.issues.forEach((issue) => {
    const fieldName = issue.path.join(".");
    if (fieldName) {
      errors[fieldName] = issue.message;
    }
  });

  return errors;
};
