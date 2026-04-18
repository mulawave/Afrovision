import { NextResponse } from "next/server";
import { getAppLinkConfig } from "@/lib/homepage";

/**
 * iOS Universal Links — Apple App Site Association file.
 * Served at /.well-known/apple-app-site-association
 *
 * The appID format is: <TeamID>.<BundleID>
 * Replace TEAM_ID_HERE with the Apple Developer Team ID.
 */
export async function GET() {
  const config = await getAppLinkConfig();

  const body = {
    applinks: {
      apps: [],
      details:
        config.ios.enabled && config.ios.team_id
          ? [
              {
                appID: `${config.ios.team_id}.${config.ios.bundle_id}`,
                paths: config.paths.length ? config.paths : ["/reset-password*"],
              },
            ]
          : [],
    },
  };

  return NextResponse.json(body, {
    headers: { "Content-Type": "application/json" },
  });
}
