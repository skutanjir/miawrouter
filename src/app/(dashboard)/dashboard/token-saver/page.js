import TokenSaverClient from "./TokenSaverClient";
import TokenSaverStatsPanel from "../components/TokenSaverStatsPanel";

export default function TokenSaverPage() {
  return (
    <div className="flex flex-col gap-6">
      <TokenSaverClient />
      <TokenSaverStatsPanel />
    </div>
  );
}
