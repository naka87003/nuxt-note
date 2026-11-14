import { isNavigationFailure, NavigationFailureType } from "vue-router";

export function assertNavigationSucceeded(result: unknown) {
  if (result === false) {
    throw new Error("Navigation was cancelled");
  }
  // Duplicate navigation means the requested location is already open.
  if (
    result instanceof Error &&
    !isNavigationFailure(result, NavigationFailureType.duplicated)
  ) {
    throw result;
  }
}
