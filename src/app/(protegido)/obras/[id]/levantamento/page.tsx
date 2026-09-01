import { redirect } from "next/navigation";

export default async function ObraLevantamentoRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/levantamento?obra=${id}`);
}
