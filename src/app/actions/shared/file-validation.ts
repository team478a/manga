const WORK_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const WORK_IMAGE_MAX_SIZE = 10 * 1024 * 1024;
const DIGITAL_PRODUCT_FILE_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
];
const DIGITAL_PRODUCT_FILE_MAX_SIZE = 50 * 1024 * 1024;

function validateFile({
  value,
  required,
  allowedTypes,
  maxBytes,
  missingMessage,
  typeMessage,
  sizeMessage,
}: {
  value: FormDataEntryValue | null;
  required: boolean;
  allowedTypes: readonly string[];
  maxBytes: number;
  missingMessage: string;
  typeMessage: string;
  sizeMessage: string;
}) {
  if (!(value instanceof File) || value.size === 0) {
    if (required) throw new ValidationError(missingMessage);
    return null;
  }
  if (!allowedTypes.includes(value.type)) throw new ValidationError(typeMessage);
  if (value.size > maxBytes) throw new PayloadTooLargeError(sizeMessage);
  return value;
}

export function validateWorkImage(
  value: FormDataEntryValue | null,
  required: boolean,
) {
  return validateFile({
    value,
    required,
    allowedTypes: WORK_IMAGE_TYPES,
    maxBytes: WORK_IMAGE_MAX_SIZE,
    missingMessage: "作品画像を選んでください。",
    typeMessage: "画像はJPG、PNG、WebPのいずれかを選んでください。",
    sizeMessage: "画像サイズは10MB以内にしてください。",
  });
}

export function validateDigitalProductFile(
  value: FormDataEntryValue | null,
  required: boolean,
) {
  return validateFile({
    value,
    required,
    allowedTypes: DIGITAL_PRODUCT_FILE_TYPES,
    maxBytes: DIGITAL_PRODUCT_FILE_MAX_SIZE,
    missingMessage: "ダウンロード用ファイルを選んでください。",
    typeMessage:
      "販売ファイルはPDF、PNG、JPG、ZIPのいずれかを選んでください。",
    sizeMessage: "販売ファイルのサイズは50MB以内にしてください。",
  });
}
import {
  PayloadTooLargeError,
  ValidationError,
} from "@/lib/domain-errors";
