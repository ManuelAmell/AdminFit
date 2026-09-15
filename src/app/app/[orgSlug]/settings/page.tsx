import { redirect } from "next/navigation";

export default async function SettingsIndexPage({ params }: PageProps<"/app/[orgSlug]/settings">) {
  const { orgSlug } = await params;
  redirect(`/app/${orgSlug}/settings/team`);
}
