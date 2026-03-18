import { notFound } from "next/navigation";
import { getTemplate } from "@/app/actions/templates";
import TemplateForm from "../../TemplateForm";

export default async function EditTemplatePage({ params }: { params: { id: string } }) {
  const template = await getTemplate(params.id);
  if (!template) notFound();
  return <TemplateForm template={template} />;
}
