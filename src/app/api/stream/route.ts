// src/app/api/stream/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { getCorsHeaders } from "@/lib/api/cors";
import { internalError, validationError } from "@/lib/api/errors";
import { type AuthContext, secureRoute } from "@/lib/api/secure-route";
import { logger } from "@/lib/logger";
import {
	createSSEMessage,
	SSE_MESSAGE_TYPES,
	sseServer,
} from "@/lib/streaming/sse-server";

export const GET = secureRoute(
	async (request: NextRequest, ctx: AuthContext) => {
		const { userId, organizationId } = ctx;
		const { searchParams } = new URL(request.url);

		const clientId =
			searchParams.get("clientId") || `client_${Date.now()}_${Math.random()}`;
		const channels = searchParams.get("channels")?.split(",") || [];

		let resolveResponse!: (r: Response) => void;
		const responseReady = new Promise<Response>((r) => {
			resolveResponse = r;
		});

		const stream = new ReadableStream({
			start(controller) {
				const welcomeMessage = createSSEMessage(
					SSE_MESSAGE_TYPES.CONNECTION_ESTABLISHED,
					{
						clientId,
						organizationId,
						userId,
						channels,
						timestamp: new Date().toISOString(),
					},
				);

				controller.enqueue(
					new TextEncoder().encode(
						`id: ${welcomeMessage.id}\nevent: ${welcomeMessage.type}\ndata: ${JSON.stringify(welcomeMessage.data)}\ntimestamp: ${welcomeMessage.timestamp}\n\n`,
					),
				);

				responseReady.then((resp) => {
					sseServer.addClient(
						clientId,
						resp,
						organizationId,
						userId,
						channels,
						controller,
					);
				});

				logger.info("SSE connection established", {
					clientId,
					organizationId,
					channels,
				});
			},
			cancel() {
				sseServer.removeClient(clientId);
				logger.info("SSE connection closed", { clientId });
			},
		});

		const response = new Response(stream, {
			headers: {
				"Content-Type": "text/event-stream",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				...getCorsHeaders(request.headers.get("origin")),
			},
		});

		resolveResponse?.(response);
		return response as unknown as import("next/server").NextResponse;
	},
);

export const POST = secureRoute(
	async (request: NextRequest, ctx: AuthContext) => {
		try {
			const { organizationId } = ctx;
			const body = await request.json();

			const { type, data, target, targetId } = body;

			if (!type || !data) {
				return validationError("Missing type or data");
			}

			const message = createSSEMessage(type, data);

			let sentCount = 0;

			switch (target) {
				case "organization":
					sentCount = sseServer.sendToOrganization(organizationId, message);
					break;
				case "user":
					if (!targetId) {
						return validationError("Missing targetId for user target");
					}
					sentCount = sseServer.sendToUser(targetId, message);
					break;
				case "channel":
					if (!targetId) {
						return validationError("Missing targetId for channel target");
					}
					sentCount = sseServer.sendToChannel(targetId, message);
					break;
				default:
					return validationError("Invalid target");
			}

			return NextResponse.json({
				success: true,
				sentCount,
				message: `Message sent to ${sentCount} clients`,
			});
		} catch (error: unknown) {
			logger.error("SSE POST error", { error });
			return internalError();
		}
	},
);
