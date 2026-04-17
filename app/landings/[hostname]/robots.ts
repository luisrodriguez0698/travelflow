import { MetadataRoute } from 'next';

interface Props {
  params: Promise<{ hostname: string }>;
}

export default async function robots({ params }: Props): Promise<MetadataRoute.Robots> {
  const { hostname } = await params;
  const baseUrl = `https://${hostname}`;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
