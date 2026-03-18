import { getTemplates } from "@/app/actions/templates";
import TemplatesClient from "./TemplatesClient";

export default async function TemplatesPage() {
  const templates = await getTemplates();
  return <TemplatesClient initialTemplates={templates} />;
}
