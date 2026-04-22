import { listArtistsFromDb } from "@/lib/data/artists";
import CampaignBuilder from "./builder";

export const dynamic = "force-dynamic";

export default async function NewCampaignPage() {
  const artists = await listArtistsFromDb();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          New campaign
        </h1>
        <p className="mt-1 text-sm text-white/60">
          Build a multi-surface drop. Fill in only the sections you want — everything else stays empty.
          Hit Publish to fan out across community, marketplace, and fan CTAs.
        </p>
      </div>
      <CampaignBuilder artists={artists.map((a) => ({ slug: a.slug, name: a.name }))} />
    </div>
  );
}
