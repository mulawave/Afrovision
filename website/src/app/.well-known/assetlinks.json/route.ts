import { NextResponse } from "next/server";
import { getAppLinkConfig } from "@/lib/homepage";

/**
 * Android App Links — Digital Asset Links statement.
 *
 * IMPORTANT: Replace the sha256_cert_fingerprints value below with the real
 * SHA-256 fingerprint of the signing certificate used to publish the APK.
 * Run:  keytool -list -v -keystore <path-to-keystore> -alias <alias>
 * and use the SHA-256 value (colon-separated hex).
 */
export async function GET() {
  const config = await getAppLinkConfig();

  const body =
    config.android.enabled && config.android.sha256_cert_fingerprints.length > 0
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: config.android.package_name,
              sha256_cert_fingerprints: config.android.sha256_cert_fingerprints,
            },
          },
        ]
      : [];

  return NextResponse.json(body, {
    headers: { "Content-Type": "application/json" },
  });
}
