export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "AppError";
  }
}

export function asyncHandler(handler) {
  return (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);
}
