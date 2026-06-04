import RequirementClient from "./RequirementClient";

export const dynamic = "force-dynamic";

export default function RequirementPage({ params }: { params: { id: string } }) {
  return <RequirementClient id={params.id} />;
}
