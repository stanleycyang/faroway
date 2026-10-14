export const AUTH_REQUEST_DEADLINE_MS = 20_000;

export class AuthRequestTimeoutError extends Error {
  constructor() {
    super("The request took too long. Its result could not be confirmed.");
    this.name = "AuthRequestTimeoutError";
  }
}

/** A late SDK response cannot replace the recovery state after this deadline. */
export async function withAuthRequestDeadline<T>(
  operation: Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new AuthRequestTimeoutError()),
      AUTH_REQUEST_DEADLINE_MS,
    );
  });
  try {
    return await Promise.race([operation, deadline]);
  } finally {
    clearTimeout(timer);
  }
}
