import { LiveStream } from "./LiveStream";

interface LivePageProps {
  params: Promise<{ id: string }>;
}

export default async function LivePage({ params }: LivePageProps) {
  const { id } = await params;
  return <LiveStream id={id} />;
}
