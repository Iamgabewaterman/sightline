import { getTemplates } from "@/app/actions/templates";
import NewJobForm from "./NewJobForm";

export default async function NewJobPage() {
  const templates = await getTemplates();
  return <NewJobForm templates={templates} />;
}
