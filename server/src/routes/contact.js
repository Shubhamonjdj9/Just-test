import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { validate } from "../middleware/validate.js";
import { ContactMessage } from "../models/index.js";
import { contactSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/errors.js";

const router = Router();
const submissionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Please try again later." },
});

router.post(
  "/",
  submissionLimiter,
  validate(contactSchema),
  asyncHandler(async (request, response) => {
    const { name, email, subject, message, website } = request.body;
    if (website) return response.status(400).json({ error: "We could not process this submission." });
    const contact = await ContactMessage.create({ name, email, subject, message });
    response.status(201).json({
      data: { id: contact.id, message: "Thank you. Our team will be in touch soon." },
    });
  }),
);

export default router;
