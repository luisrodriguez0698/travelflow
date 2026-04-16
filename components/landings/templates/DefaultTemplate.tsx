'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/all';
import type { TenantLandingData } from '../LandingRenderer';

// ─── Imágenes placeholder — reemplaza con las imágenes reales de cada agencia ─
const GALLERY_IMAGES = [
  'https://assets.codepen.io/16327/portrait-pattern-1.jpg',
  'https://assets.codepen.io/16327/portrait-image-12.jpg',
  'https://assets.codepen.io/16327/portrait-image-8.jpg',
  'https://assets.codepen.io/16327/portrait-pattern-2.jpg',
  'https://assets.codepen.io/16327/portrait-image-4.jpg',
  'https://assets.codepen.io/16327/portrait-image-3.jpg',
  'https://assets.codepen.io/16327/portrait-pattern-3.jpg',
  'https://assets.codepen.io/16327/portrait-image-1.jpg',
];

// grid-area para cada item en el layout bento inicial
const BENTO_AREAS = [
  '1 / 1 / 3 / 2',
  '1 / 2 / 2 / 3',
  '2 / 2 / 4 / 3',
  '1 / 3 / 3 / 4',
  '3 / 1 / 4 / 2',
  '3 / 3 / 5 / 4',
  '4 / 1 / 5 / 2',
  '4 / 2 / 5 / 3',
];

export function DefaultTemplate({ tenant }: { tenant: TenantLandingData }) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const flipCtxRef = useRef<gsap.Context | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, Flip);

    const createTween = () => {
      const gallery = galleryRef.current;
      if (!gallery) return;

      const items = gallery.querySelectorAll<HTMLElement>('.bento-item');

      // Limpiar animación anterior si existe (resize)
      flipCtxRef.current?.revert();
      gallery.classList.remove('bento-final');

      flipCtxRef.current = gsap.context(() => {
        // Capturar el estado "expandido" con la clase final
        gallery.classList.add('bento-final');
        const flipState = Flip.getState(items);
        gallery.classList.remove('bento-final');

        // Crear la animación Flip
        const flip = Flip.to(flipState, {
          simple: true,
          ease: 'expoScale(1, 5)',
        });

        // Vincular al scroll
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: gallery,
            start: 'center center',
            end: '+=100%',
            scrub: true,
            pin: gallery.parentElement,
          },
        });
        tl.add(flip);

        return () => gsap.set(items, { clearProps: 'all' });
      });
    };

    createTween();
    window.addEventListener('resize', createTween);

    return () => {
      flipCtxRef.current?.revert();
      window.removeEventListener('resize', createTween);
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return (
    <main className="h-full bg-white text-gray-800 font-sans">
      {/* ── CSS del bento grid (no se puede expresar completamente con Tailwind) ── */}
      <style>{`
        .bento-gallery {
          display: grid;
          gap: 1vh;
          grid-template-columns: repeat(3, 33vw);
          grid-template-rows: repeat(4, 23vh);
          justify-content: center;
          align-content: center;
          width: 100%;
          height: 100%;
        }
        .bento-final {
          grid-template-columns: repeat(3, 100vw) !important;
          grid-template-rows: repeat(4, 50vh) !important;
          gap: 1vh !important;
        }
        .bento-item {
          overflow: hidden;
          position: relative;
        }
        .bento-item img {
          object-fit: cover;
          width: 100%;
          height: 100%;
          display: block;
        }
      `}</style>

      {/* ── Hero con nombre de la agencia ── */}
      {/* <section className="relative z-10 flex flex-col items-center justify-center gap-4 px-6 py-20 bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-center">
        {tenant.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logo}
            alt={`Logo ${tenant.name}`}
            className="h-16 object-contain"
          />
        )}
        <h1 className="text-5xl font-bold tracking-tight">{tenant.name}</h1>
        <p className="text-lg text-blue-100 max-w-xl">
          Tu agencia de confianza para los mejores destinos del mundo.
        </p>
        <a
          href={`mailto:${tenant.email}`}
          className="mt-2 rounded-full bg-white text-blue-700 font-semibold px-8 py-3 shadow hover:bg-blue-50 transition"
        >
          Cotiza tu viaje
        </a>
      </section> */}

      {/* ── Galería bento con animación GSAP Flip + ScrollTrigger ── */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        <div ref={galleryRef} className="bento-gallery">
          {GALLERY_IMAGES.map((src, i) => (
            <div
              key={i}
              className="bento-item"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Destino ${i + 1}`} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Contenido / Descripción ── */}
      <section className="px-10 py-20 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6">Viaja con nosotros</h2>
        <div className="space-y-4 text-gray-600 text-lg leading-relaxed">
          <p>
            En {tenant.name} nos especializamos en crear experiencias de viaje únicas y
            personalizadas. Cada destino es una historia que contamos junto a ti.
          </p>
          <p>
            Desde escapadas de fin de semana hasta grandes aventuras internacionales,
            nuestro equipo diseña cada detalle para que solo te preocupes de disfrutar.
          </p>
          <p>
            Contamos con años de experiencia en el sector turístico y una red de aliados
            en los principales destinos del mundo para garantizarte el mejor servicio.
          </p>
        </div>
      </section>

      {/* ── Contacto ── */}
      <section className="bg-gray-50 px-10 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-10">Contáctanos</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-white border p-6 text-sm shadow-sm">
              <p className="font-medium text-gray-400 mb-2 uppercase tracking-wide text-xs">Correo</p>
              <a href={`mailto:${tenant.email}`} className="text-blue-600 hover:underline break-all font-medium">
                {tenant.email}
              </a>
            </div>
            <div className="rounded-xl bg-white border p-6 text-sm shadow-sm">
              <p className="font-medium text-gray-400 mb-2 uppercase tracking-wide text-xs">Teléfono</p>
              <a href={`tel:${tenant.phone}`} className="text-blue-600 hover:underline font-medium">
                {tenant.phone}
              </a>
            </div>
            {tenant.address && (
              <div className="rounded-xl bg-white border p-6 text-sm shadow-sm">
                <p className="font-medium text-gray-400 mb-2 uppercase tracking-wide text-xs">Dirección</p>
                <p className="font-medium">{tenant.address}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {tenant.name}. Todos los derechos reservados.
      </footer>
    </main>
  );
}
