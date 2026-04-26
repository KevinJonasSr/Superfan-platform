import { getAdminContext } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import EditRewardForm from "./reward-form";

export const dynamic = "force-dynamic";

export default async function EditRewardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login");

  const supabase = createAdminClient();
  const { data: reward } = await supabase
    .from("rewards_catalog")
    .select("*")
    .eq("id", id)
    .eq("community_id", ctx.currentCommunityId || "")
    .maybeSingle();

  if (!reward) notFound();

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Edit Reward</h1>
      <EditRewardForm reward={reward} />
    </div>
  );
}
