import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PAGE_COPY_FALLBACKS, type PublicPageData } from "@buffet/shared";
import { PublicPage } from "@/components/public/public-page";

// `cache` evita o segundo fetch: generateMetadata e a página usam o mesmo dado.
const fetchOrg = cache(async (slug: string): Promise<PublicPageData | null> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";
  const res = await fetch(`${apiUrl}/public/orgs/${slug}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await fetchOrg(slug);
  if (!org) return { title: "Buffet não encontrado" };

  const title = org.settings.headline ?? org.name;
  const description =
    org.settings.subheadline ?? PAGE_COPY_FALLBACKS.subheadline;
  return {
    title: `${title} — orçamento`,
    description,
    openGraph: {
      title,
      description,
      locale: "pt_BR",
      type: "website",
      ...(org.settings.coverUrl ? { images: [org.settings.coverUrl] } : {}),
    },
  };
}

// RF17: página pública resolvida pelo slug da organização; o layout escolhido
// pelo buffet (RF26) é aplicado pelo `PublicPage`.
export default async function PublicOnboardingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await fetchOrg(slug);
  if (!org) notFound();

  return <PublicPage data={org} />;
}
