export function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function formText(formData: FormData, key: string) {
  return formString(formData, key).trim();
}
