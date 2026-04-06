import { ChannelProfile } from "./ChannelProfile";

interface ChannelPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { id } = await params;
  return <ChannelProfile id={id} />;
}
