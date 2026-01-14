import { redirect } from 'next/navigation';

export default function SiteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Redirect to dashboard page - layout will handle the navigation
  redirect(`/sites/${params.id}/dashboard`);
}

