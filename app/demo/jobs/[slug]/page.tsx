import { notFound } from "next/navigation";
import { getDemoJob } from "@/app/demo/_data";
import DemoJobView from "@/components/demo/DemoJobView";

export function generateStaticParams() {
  return [
    { slug: "riverside-bath" },
    { slug: "hawthorne-kitchen" },
    { slug: "sellwood-deck" },
  ];
}

export default function DemoJobPage({ params }: { params: { slug: string } }) {
  const job = getDemoJob(params.slug);
  if (!job) notFound();
  return <DemoJobView job={job} />;
}
