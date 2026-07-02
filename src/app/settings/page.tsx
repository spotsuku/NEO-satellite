import { getDashboardData } from "@/lib/data";
import SettingsClient from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getDashboardData();
  return <SettingsClient data={data} />;
}
