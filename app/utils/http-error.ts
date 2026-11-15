export function getErrorStatusCode(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
}

export function getErrorStatusMessage(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "statusMessage" in error.data &&
    typeof error.data.statusMessage === "string"
  ) {
    return error.data.statusMessage;
  }
}
