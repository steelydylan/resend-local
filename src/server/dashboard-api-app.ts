import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getEmails } from "./usecases/get-emails";
import { getAttachmentFile } from "./usecases/get-attachment";
import { getDomains } from "./usecases/get-domains";
import { getDomain } from "./usecases/get-domain";
import { getAPIKeys } from "./usecases/get-api-keys";

export const serverApp = new Hono()

  .basePath("/dashboard-api")

  .get(
    "/emails",
    zValidator(
      "query",
      z.object({
        offset: z.coerce.number().default(0),
        limit: z.coerce.number().default(10),
      }),
    ),
    async (c) => {
      return c.json(await getEmails(c.req.valid("query")));
    },
  )

  .get(
    "/domains",
    zValidator(
      "query",
      z.object({
        offset: z.coerce.number().default(0),
        limit: z.coerce.number().default(10),
      }),
    ),
    async (c) => {
      return c.json(await getDomains(c.req.valid("query")));
    },
  )

  .get("/domains/:domainId", async (c) => {
    return c.json(await getDomain(c.req.param("domainId")));
  })

  .get(
    "/api-keys",
    zValidator(
      "query",
      z.object({
        offset: z.coerce.number().default(0),
        limit: z.coerce.number().default(10),
      }),
    ),
    async (c) => {
      return c.json(await getAPIKeys(c.req.valid("query")));
    },
  )

  .get("/attachments/:attachmentId", async (c) => {
    const attachment = await getAttachmentFile(c.req.param("attachmentId"));
    if (!attachment) {
      return c.text("Attachment not found", 404);
    }

    // SQLite blob can return different types depending on the driver
    let content: Uint8Array;
    if (Buffer.isBuffer(attachment.content)) {
      content = new Uint8Array(attachment.content);
    } else if (attachment.content instanceof ArrayBuffer) {
      content = new Uint8Array(attachment.content);
    } else if (attachment.content instanceof Uint8Array) {
      content = attachment.content;
    } else {
      // Fallback: try to convert from whatever type it is
      content = new Uint8Array(Buffer.from(attachment.content as unknown as string, "base64"));
    }

    return c.body(content, {
      headers: {
        "Content-Type": attachment.contentType,
        "Content-Disposition": `attachment; filename="${attachment.filename}"`,
      },
    });
  });
