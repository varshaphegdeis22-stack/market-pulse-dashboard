import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { logger } from "../lib/logger";

const router = Router();

const loginSchema = z.object({ email: z.email() });

router.post("/auth/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }

  const { email } = parsed.data;

  try {
    let user = await db.select().from(usersTable).where(eq(usersTable.email, email)).then((r) => r[0]);

    if (!user) {
      const [created] = await db.insert(usersTable).values({ email }).returning();
      user = created;
    }

    (req.session as any).userId = user!.id;

    res.json({ id: user!.id, email: user!.email });
  } catch (err) {
    logger.error({ err }, "Login error");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", async (req, res) => {
  const userId = (req.session as any).userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const user = await db.select().from(usersTable).where(eq(usersTable.id, userId)).then((r) => r[0]);
    if (!user) {
      req.session.destroy(() => {});
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    logger.error({ err }, "Get me error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
