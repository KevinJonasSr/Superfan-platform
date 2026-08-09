import { FanHome } from "../../components/FanHome";
import { fanHomeData } from "../../data/fanHome";

interface ArtistPageProps {
  params: { artist: string };
}

export function generateMetadata({ params }: ArtistPageProps) {
  const slug = params.artist?.toLowerCase();
  const data = fanHomeData[slug] ?? fanHomeData.default;
  return {
    title: `${data.heroTitle} · Fan Engage`,
    description: data.heroSubtitle,
  };
}

export default function ArtistPage({ params }: ArtistPageProps) {
  const slug = params.artist?.toLowerCase();
  const data = fanHomeData[slug] ?? fanHomeData.default;
  return <FanHome data={data} />;
}
