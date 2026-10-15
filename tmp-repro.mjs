process.env.DEV_AUTH_BYPASS = "true";
process.env.DEV_PROFILE_ID = "ddbf632a-9a37-4022-9d43-ec1221e28c27";
import { POST } from "./src/app/api/weekly-plans/route.ts";
import { NextRequest } from "next/server";

const req = new NextRequest("http://localhost/api/weekly-plans", {
  method: "POST",
  headers: { "content-type": "application/json", "x-dev-profile-id": process.env.DEV_PROFILE_ID },
  body: JSON.stringify({ planDate: "2026-10-15", title: "Reproducao erro adicionar", categoryId: undefined }),
});
try {
  const res = await POST(req);
  const body = await res.json();
  console.log("STATUS", res.status);
  console.log(JSON.stringify(body, null, 1));
} catch (e) {
  console.log("THREW:", String(e));
}
