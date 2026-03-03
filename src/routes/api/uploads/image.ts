import { createFileRoute } from "@tanstack/react-router";
import { UTApi } from "uploadthing/server";
import { errorResponse } from "#/lib/posts/http";
import { requireSessionUser } from "#/lib/spaces/auth-session.server";

const utapi = new UTApi();

export const Route = createFileRoute("/api/uploads/image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          await requireSessionUser(request);

          if (!process.env.UPLOADTHING_TOKEN) {
            return errorResponse(
              503,
              "upload_not_configured",
              "UploadThing is not configured on this environment.",
            );
          }

          const formData = await request.formData();
          const uploadedFile = formData.get("file");
          if (!(uploadedFile instanceof File)) {
            return errorResponse(422, "invalid_input", "A file is required.");
          }

          const uploadResult = await utapi.uploadFiles(uploadedFile, {
            contentDisposition: "inline",
          });

          if (!uploadResult.data || uploadResult.error) {
            return errorResponse(502, "upload_failed", "Image upload failed.");
          }

          const file = uploadResult.data;
          return Response.json(
            {
              imageUrl: file.ufsUrl ?? file.url,
              imageMeta: {
                key: file.key,
                appUrl: file.appUrl,
                ufsUrl: file.ufsUrl,
                name: file.name,
                size: file.size,
                type: file.type,
                fileHash: file.fileHash,
              },
            },
            { status: 201 },
          );
        } catch (error) {
          if (error instanceof Error && error.message === "Unauthorized") {
            return errorResponse(401, "unauthorized", "Authentication required.");
          }

          return errorResponse(500, "upload_failed", "Unexpected upload error.");
        }
      },
    },
  },
});
