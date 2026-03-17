import { getTaxReport } from "@/app/actions/tax";
import TaxClient from "./TaxClient";

export default async function TaxPage() {
  const year = new Date().getFullYear();
  const data = await getTaxReport(year);
  return <TaxClient initial={data} />;
}
