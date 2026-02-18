import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized, internalError } from "@/lib/api/errors";
import { Autumn as autumn, type AutumnError } from "autumn-js";

type BillingPortalResult = {
  url: string;
};

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    return unauthorized("Unauthorized");
  }

  let body = {};
  try {
    body = await request.json();
  } catch {}

  const { returnUrl } = body as { returnUrl?: string };

  try {
    const result = await autumn.customers.billingPortal(session.user.id, {
      return_url: returnUrl || undefined,
    });

    if ('error' in result) {
      console.error('Billing portal error:', result.error?.message || 'Unknown error');
      return internalError('Failed to generate billing portal URL');
    }

    const { url } = result;

    return NextResponse.json({ url }, { status: 200 });
  } catch (err: unknown) {
    console.error('Billing portal error:', err);
    return internalError('Failed to generate billing portal URL');
  }
}
