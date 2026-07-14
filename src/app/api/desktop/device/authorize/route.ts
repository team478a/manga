import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEVICE_PENDING_MINUTES,
  generateDeviceSecret,
  generateUserCode,
  hashDeviceSecret,
} from "@/lib/desktop-auth";

const requestSchema = z.object({
  deviceName: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { message: "端末名が不正です。" },
        { status: 400 },
      );
    const admin = createAdminClient();
    const deviceToken = generateDeviceSecret();
    const expiresAt = new Date(
      Date.now() + DEVICE_PENDING_MINUTES * 60_000,
    ).toISOString();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const userCode = generateUserCode();
      const { error } = await admin
        .from("desktop_device_authorizations")
        .insert({
          device_name: parsed.data.deviceName,
          secret_hash: hashDeviceSecret(deviceToken),
          user_code: userCode,
          status: "pending",
          expires_at: expiresAt,
        });
      if (!error)
        return NextResponse.json(
          {
            status: "pending",
            deviceToken,
            userCode,
            verificationPath: `/dashboard/devices/authorize?code=${encodeURIComponent(userCode)}`,
            expiresAt,
            intervalSeconds: 5,
          },
          { status: 201 },
        );
      if (error.code !== "23505") throw new Error(error.message);
    }
    throw new Error("認証コードを作成できませんでした。");
  } catch (cause) {
    console.error("Desktop device authorization start failed", cause);
    return NextResponse.json(
      { message: "端末認証を開始できませんでした。" },
      { status: 503 },
    );
  }
}
