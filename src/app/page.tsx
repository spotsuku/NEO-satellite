import { getDashboardData } from "@/lib/data";
import Dashboard from "@/components/Dashboard";

// 常に最新を反映（成立記録・編集後の revalidate と整合）
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await getDashboardData();
  return <Dashboard data={data} />;
}
