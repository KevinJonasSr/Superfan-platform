import { FanHome } from "../components/FanHome";
import { fanHomeData } from "../data/fanHome";

export default function Home() {
  return <FanHome data={fanHomeData.default} />;
}
