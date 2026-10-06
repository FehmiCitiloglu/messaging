import { Router } from "express";
import type { Response } from "express";
import { z } from "zod";
import { escapeLike, findUserById, sql } from "../db.js";
import type { UserRow } from "../db.js";
import { errors } from "../lib/errors.js";
import { authenticatedUserId, requireAuth } from "../middleware/auth.js";
import { validateQuery } from "../lib/http.js";
import { toUser } from "../serializers.js";
import type { User } from "../types.js";

const searchSchema = z.strictObject({
  q: z.string().min(1).max(100).optional(),
});

export const usersRouter: Router = Router();

usersRouter.use(requireAuth);

usersRouter.get("/me", (req, res: Response): void => {
  const me = findUserById(authenticatedUserId(req));
  if (!me) throw errors.notFound("User not found");
  res.json({ user: toUser(me) });
});

usersRouter.get(
  "/",
  validateQuery(searchSchema),
  (req, res: Response): void => {
    const meId = authenticatedUserId(req);
    const query = res.locals["query"] as z.infer<typeof searchSchema>;
    const term = (query.q ?? "").trim();
    if (term.length === 0) {
      res.json({ users: [] });
      return;
    }
    const pattern = `%${escapeLike(term)}%`;
    const rows = sql(
      `SELECT ${"id, username, display_name, avatar_url, last_seen_at, created_at"}
       FROM users
       WHERE id != ?
         AND (username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\')
       ORDER BY username ASC
       LIMIT 20`,
    ).all(meId, pattern, pattern) as UserRow[];
    const users: User[] = rows.map(toUser);
    res.json({ users });
  },
);