import { OperatorGate } from "@/components/dashboard/operator-gate";

export default async function DashboardGatePage({
  params,
}: PageProps<"/dashboard/[slug]">) {
  const { slug } = await params;
  return <OperatorGate slug={slug} />;
}
