import { ExclusiveAccessGate } from "./ExclusiveAccessGate";

interface ExclusiveAccessPageProps {
  params: Promise<{ id: string }>;
}

export default async function ExclusiveAccessPage({ params }: ExclusiveAccessPageProps) {
  const { id } = await params;
  return <ExclusiveAccessGate id={id} />;
}
