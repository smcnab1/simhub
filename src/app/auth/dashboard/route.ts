import { redirect } from "next/navigation";

export async function GET() {
  redirect("/auth/sign-in?returnTo=/dashboard");
}
