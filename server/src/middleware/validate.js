import { AppError } from "../utils/errors.js";

export function validate(schema, source = "body") {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);
    if (!result.success) {
      return next(
        new AppError(400, result.error.issues.map((issue) => issue.message).join(" ")),
      );
    }
    request[source] = result.data;
    next();
  };
}
