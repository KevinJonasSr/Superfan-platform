import type { Metadata } from "next";
import PolicyPage from "@/app/(legal)/policy-page";

export const metadata: Metadata = {
  title: "Cookie Policy · Fan Engage",
};

export const dynamic = "force-dynamic";

export default function Page() {
  return <PolicyPage slug="cookie_policy" />;
}
