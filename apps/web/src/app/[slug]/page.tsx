import { notFound } from "next/navigation";
import { LeadForm } from "@/components/public/lead-form";

interface PublicOrg {
  id: string;
  name: string;
  slug: string;
  packages: {
    id: string;
    name: string;
    description: string | null;
    pricePerPerson: string;
  }[];
}

async function fetchOrg(slug: string): Promise<PublicOrg | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/public/orgs/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

// RF17: public onboarding page resolved by organization slug.
export default async function PublicOnboardingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await fetchOrg(slug);
  if (!org) notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 py-10">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
        <p className="text-muted-foreground">
          Monte seu evento e receba um orçamento na hora.
        </p>
      </header>
      <LeadForm slug={org.slug} orgName={org.name} packages={org.packages} />
      <p className="text-center text-xs text-muted-foreground">
        Seus dados serão usados apenas para o atendimento comercial.
      </p>
    </main>
  );
}
