# Guía de Landings Multitenant — TravelFlow

Esta guía cubre dos operaciones clave:
1. Cómo mapear un dominio de Hostinger a tu proyecto en Railway.
2. Cómo crear un diseño único (template) para un tenant específico.

---

## 1. Mapear un dominio de Hostinger a Railway

### Paso A — Obtener el dominio de tu servicio en Railway

1. Abre tu proyecto en [Railway](https://railway.app).
2. Selecciona el servicio de Next.js.
3. Ve a **Settings → Networking → Custom Domain**.
4. Haz clic en **Add Custom Domain** e ingresa el dominio del tenant
   (e.g. `www.agenciapato.com`).
5. Railway te mostrará un **registro CNAME** similar a:

   ```
   CNAME  www  →  <hash>.up.railway.app
   ```

### Paso B — Configurar DNS en Hostinger

1. Inicia sesión en [Hostinger](https://hpanel.hostinger.com) y ve a
   **Dominios → Administrar → DNS / Zona DNS**.
2. Elimina cualquier registro `A` o `CNAME` existente para `www`.
3. Crea un nuevo registro:

   | Tipo  | Nombre | Apunta a                  | TTL  |
   |-------|--------|---------------------------|------|
   | CNAME | www    | `<hash>.up.railway.app`   | 3600 |

4. Si el tenant usa el dominio raíz (`agenciapato.com` sin `www`), algunos
   registradores requieren un **registro A** en vez de CNAME. En ese caso
   usa la IP que Railway te indique, o redirige el apex a `www` desde Hostinger.

5. Espera la propagación DNS (5–30 minutos).

### Paso C — Registrar el dominio en la BD del tenant

Ejecuta esta query (o hazlo desde tu panel de administración):

```sql
UPDATE tenants
SET "customDomain" = 'www.agenciapato.com'
WHERE id = '<tenant_id>';
```

O con Prisma Studio (`npx prisma studio`) edita el campo `customDomain`.

### Paso D — Variable de entorno en Railway

Verifica que la variable `NEXT_PUBLIC_APP_HOSTNAME` esté configurada en
Railway con el hostname **principal** del SaaS (sin `https://` ni `/`):

```
NEXT_PUBLIC_APP_HOSTNAME=travelflow.up.railway.app
```

Esto le indica al middleware cuál es el dominio propio del SaaS para no
confundirlo con un dominio personalizado.

---

## 2. Crear un template de diseño único para un tenant

### Estructura de archivos

```
components/
  landings/
    LandingRenderer.tsx          ← selector de templates (NO editar salvo añadir case)
    templates/
      DefaultTemplate.tsx        ← template base
      ModernTemplate.tsx         ← ejemplo adicional
      AgenciaPaToTemplate.tsx    ← template exclusivo de un tenant
```

### Paso A — Crear el archivo del template

Crea un nuevo archivo en `components/landings/templates/`:

```tsx
// components/landings/templates/AgenciaPaToTemplate.tsx
import type { TenantLandingData } from '../LandingRenderer';

export function AgenciaPaToTemplate({ tenant }: { tenant: TenantLandingData }) {
  return (
    <main>
      <h1>{tenant.name}</h1>
      {/* Tu diseño personalizado aquí */}
    </main>
  );
}
```

El tipo `TenantLandingData` provee los campos:

| Campo             | Tipo            | Descripción                  |
|-------------------|-----------------|------------------------------|
| `id`              | `string`        | ID del tenant                |
| `name`            | `string`        | Nombre de la agencia         |
| `logo`            | `string \| null`| URL del logo (cloud storage) |
| `email`           | `string`        | Email de contacto            |
| `phone`           | `string`        | Teléfono                     |
| `address`         | `string \| null`| Dirección física             |
| `landingTemplate` | `string`        | Nombre del template activo   |

Si necesitas más datos del tenant, agrégalos al `select` en
`app/landings/[hostname]/page.tsx` y amplía la interfaz en `LandingRenderer.tsx`.

### Paso B — Registrar el template en el selector

Abre `components/landings/LandingRenderer.tsx` y añade el `case`:

```tsx
import { AgenciaPaToTemplate } from './templates/AgenciaPaToTemplate';

// Dentro del switch:
case 'agenciapato':
  return <AgenciaPaToTemplate tenant={tenant} />;
```

### Paso C — Asignar el template al tenant en la BD

```sql
UPDATE tenants
SET "landingTemplate" = 'agenciapato'
WHERE id = '<tenant_id>';
```

O con Prisma Studio edita el campo `landingTemplate`.

---

## 3. Flujo completo de una petición

```
Usuario visita www.agenciapato.com
       ↓
middleware.ts detecta que NO es el dominio principal del SaaS
       ↓
Rewrite interno: / → /landings/www.agenciapato.com
       ↓
app/landings/[hostname]/page.tsx
  → prisma.tenant.findFirst({ where: { customDomain: 'www.agenciapato.com' } })
       ↓
LandingRenderer selecciona el template según landingTemplate
       ↓
Renderiza el diseño único del tenant
```

Las rutas del SaaS (`/dashboard`, `/login`, `/api`, etc.) siguen funcionando
bajo `travelflow.up.railway.app` sin interferencia.

---

## 4. Subdominio interno (opcional)

Si prefieres que el tenant use `agenciapato.travelflow.up.railway.app` sin
configurar un dominio externo:

1. Asigna el subdomain en la BD:

   ```sql
   UPDATE tenants SET subdomain = 'agenciapato' WHERE id = '<tenant_id>';
   ```

2. En Railway agrega `agenciapato.travelflow.up.railway.app` como dominio
   personalizado (o usa un wildcard `*.travelflow.up.railway.app` si tu plan
   lo soporta).

3. El middleware detecta automáticamente el subdominio y hace el rewrite.

---

## 5. Comandos útiles

```bash
# Generar y aplicar la migración de los nuevos campos
npx prisma migrate dev --name add_landing_fields

# Abrir Prisma Studio para editar tenants visualmente
npx prisma studio

# Ver los tenants con sus dominios configurados
npx prisma db execute --stdin <<EOF
SELECT id, name, "customDomain", subdomain, "landingTemplate" FROM tenants;
EOF
```
