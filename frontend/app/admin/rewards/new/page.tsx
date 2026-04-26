import { getAdminContext } from "@/lib/admin";
import { redirect } from "next/navigation";
import NewRewardForm from "./reward-form";

export default async function NewRewardPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/login?next=/admin/rewards/new");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Create Reward</h1>
      <NewRewardForm />
    </div>
  );
}
