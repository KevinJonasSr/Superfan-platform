import Link from "next/link";
import { notFound } from "next/navigation";
import { getPolicy } from "@/lib/data/policies";
import PolicyEditForm from "./edit-form";

export const dynamic = "force-dynamic";

export default async function AdminPolicyEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const policy = await getPolicy(slug);
  if (!policy) notFound();

  const publicSlug = slug === "cookie_policy" ? "cookie-policy" : slug;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/admin/policies" className="text-xs text-white/60 hover:text-white">
            ← Back to policies
          </Link>
          <h1
            className="mt-2 text-2xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Edit {policy.title}
          </h1>
          <p className="mt-1 text-xs text-white/60">/{publicSlug}</p>
        </div>
        <Link
          href={`/${publicSlug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-white/20 px-4 py-2 text-xs text-white/80 hover:bg-white/10"
        >
          View public page ↗
        </Link>
      </div>

      <PolicyEditForm
        slug={policy.slug}
        initial={{
          title: policy.title,
          content_md: policy.content_md,
          effective_date: policy.effective_date ?? "",
          is_draft: policy.is_draft,
        }}
      />
    </div>
  );
}
