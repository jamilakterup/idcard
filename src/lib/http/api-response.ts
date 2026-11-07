import { NextResponse } from "next/server";

export function success<T>(data: T, message?: string, status = 200) {
  return NextResponse.json(
    { success: true, message, data },
    { status }
  );
}

export function error(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { success: false, message, ...extra },
    { status }
  );
}
