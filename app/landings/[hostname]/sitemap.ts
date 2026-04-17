import { MetadataRoute } from 'next';

// ── Configuración de tenants ──────────────────────────────────────────────────
// Para agregar un nuevo tenant, añade una entrada al objeto con su hostname.
// changeFrequency: con qué frecuencia cambia el contenido (Google lo usa como sugerencia).
// priority: importancia relativa de la URL (0.0 – 1.0).
const TENANT_CONFIGS: Record<
  string,
  {
    changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
    priority: number;
  }
> = {
  'viajaentrenubes.com': { changeFrequency: 'monthly', priority: 1 },
  // 'otraagencia.com':     { changeFrequency: 'monthly', priority: 1 },
  // 'agencia3.com':        { changeFrequency: 'weekly',  priority: 0.9 },
};

interface Props {
  params: Promise<{ hostname: string }>;
}

export default async function sitemap({ params }: Props): Promise<MetadataRoute.Sitemap> {
  const { hostname } = await params;
  const config = TENANT_CONFIGS[hostname] ?? { changeFrequency: 'monthly' as const, priority: 1 };
  const baseUrl = `https://${hostname}`;

  // Una landing de agencia es una single-page con secciones de ancla.
  // Incluimos la raíz y las secciones principales como URLs canónicas.
  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: config.changeFrequency,
      priority: config.priority,
    },
    {
      url: `${baseUrl}/#destinos`,
      lastModified: new Date(),
      changeFrequency: config.changeFrequency,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/#nosotros`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/#contacto`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.6,
    },
  ];
}
