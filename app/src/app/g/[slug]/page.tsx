import { GateView } from "@/components/gate/gate-view";

export default async function GatePage({ params }: PageProps<"/g/[slug]">) {
  const { slug } = await params;
  return <GateView slug={slug} />;
}
