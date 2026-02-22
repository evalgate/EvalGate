// Temporary type declarations for Next.js server types
declare module "next/server" {
  export interface NextRequest {
    url: string;
    method: string;
    headers: Headers;
    body: ReadableStream | null;
    json(): Promise<any>;
    text(): Promise<string>;
    nextUrl: URL;
  }

  export class NextResponse {
    headers: Headers;
    static json(data: any, init?: ResponseInit): Response;
    static redirect(url: string, init?: number | ResponseInit): Response;
    static next(): NextResponse;
  }

  export function NextRequest(input: string | Request, init?: RequestInit): NextRequest;
}
