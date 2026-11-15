import { z } from "zod";

export const chatStatusSchema = z.enum([
  "completed",
  "generating",
  "stopped",
  "failed",
]);
