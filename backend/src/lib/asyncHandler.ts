import { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 does not catch errors thrown from async route handlers. This wrapper
// forwards any rejected promise to the global error-handling middleware so a DB
// failure returns a clean 500 instead of crashing the function.
//
// Generic over the route params type (defaulting to string-valued params) so
// `req.params.foo` keeps resolving to `string` inside wrapped handlers.
export function asyncHandler<P = Record<string, string>>(
  fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler<P> {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
