import type { NextFunction, Request, Response } from "express";

/**
 * Express 4 does not forward a rejected promise from an async handler to
 * the error middleware on its own — this wrapper does that one thing.
 * (Express 5 does this natively; staying on 4 here for its more settled
 * @types/express support.)
 */
export function asyncHandler(
  handler: (req: Request, res: Response) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };
}
