import { getMachineId } from "@/shared/utils/machine";
import EndpointPageClient from "./endpoint/EndpointPageClient";

export default async function DashboardPage() {
  const machineId = await getMachineId();
  return (
    <div className="flex flex-col gap-8">
      <EndpointPageClient machineId={machineId} />
    </div>
  );
}
