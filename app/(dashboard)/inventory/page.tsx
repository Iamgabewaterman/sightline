import { getShopInventory, getActiveJobsForUser } from "@/app/actions/inventory";
import InventoryClient from "./InventoryClient";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [items, activeJobs] = await Promise.all([
    getShopInventory(),
    getActiveJobsForUser(),
  ]);

  const totalItems = items.length;
  const totalValue = items.reduce((sum, i) => sum + Number(i.estimated_value), 0);

  return (
    <InventoryClient
      initialItems={items}
      activeJobs={activeJobs}
      totalItems={totalItems}
      totalValue={totalValue}
    />
  );
}
