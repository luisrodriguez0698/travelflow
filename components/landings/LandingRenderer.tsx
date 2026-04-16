import { DefaultTemplate } from './templates/DefaultTemplate';
import { EntreNubesTemplate } from './templates/EntreNubesTemplate';

export interface LandingHotel {
  id: string;
  name: string;
  webDescription: string | null;
  packagePrice: number | null;
  packageCurrency: string | null;
  images: string[];
}

export interface LandingTestimonial {
  id: string;
  name: string;
  text: string;
  rating: number;
  source: string;
  avatarUrl: string | null;
}

export interface TenantLandingData {
  id: string;
  name: string;
  logo: string | null;
  email: string;
  phone: string;
  address: string | null;
  landingTemplate: string;
  facebookReviewUrl: string | null;
  googleReviewUrl: string | null;
  hotels?: LandingHotel[];
  testimonials?: LandingTestimonial[];
}

interface Props {
  tenant: TenantLandingData;
}

/**
 * Selecciona el componente de template correcto en función del campo
 * `landingTemplate` almacenado en la BD para cada tenant.
 *
 * Para añadir un nuevo template:
 *   1. Crea `components/landings/templates/MiTemplate.tsx`
 *   2. Imórtalo aquí y añade un case en el switch.
 *   3. Actualiza el campo `landingTemplate` del tenant en la BD.
 */
export function LandingRenderer({ tenant }: Props) {
  switch (tenant.landingTemplate) {
    // ── Añade nuevos templates aquí ──────────────────────────────────────────
    case 'entrenubes':
      return <EntreNubesTemplate tenant={tenant} />;
    // case 'modern':
    //   return <ModernTemplate tenant={tenant} />;
    // ─────────────────────────────────────────────────────────────────────────

    case 'default':
    default:
      return <DefaultTemplate tenant={tenant} />;
  }
}
