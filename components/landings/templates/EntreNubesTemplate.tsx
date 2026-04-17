'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Navigation } from 'swiper/modules';
import type { TenantLandingData, LandingHotel, LandingTestimonial } from '../LandingRenderer';

const DEFAULT_HOTEL_IMG = 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8ssMAwLqQ2veqATUR7yWXE8xwNVbjnK14Jk39s';

const CURRENCIES: Record<string, string> = {
  MXN: 'MXN', USD: 'USD', EUR: '€', CAD: 'CAD', GBP: '£',
};

/** Convierte un path de S3 en una URL servible.
 *  Si ya es una URL completa (http/https) la deja pasar. */
function toImgSrc(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `/api/files/${path}`;
}

// ── Assets ───────────────────────────────────────────────────────────────────
const ASSETS = {
  avion:    'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sGgxLyXVf0sXWBUoYJVbCT8gIv41upcmZrSGt',
  marco:    'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sn0VQcN78mXRSh4JP60iYgDv2WFk517Iyo9EN',
  nubes:    'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8ssMAwLqQ2veqATUR7yWXE8xwNVbjnK14Jk39s',
  persiana: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8st9t2C1M7eH0pN2bLYVMBTXUyskWarK8O1xn5',

  viajesNacionales: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sYIHPL0tB2GsaUk6NAEpX5QM1lHqbxodS4yJn',
  viajesInternacionales: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8serw5PmnvysRjHlrwMLYDPQE315btg2xWd8G6',
  tours: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8seCSESvnvysRjHlrwMLYDPQE315btg2xWd8G6',
  bodas: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sAkgvMm1C8H5kWLmsGbRAJZ7zFt9NcrPX36v2',
  lunaDeMiel: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8s6w1SgwavsnI0w5UGhVTrYABbLmRQJi4X1oSa',

  chicas: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8s75UGf9OWVTdwlY2nKaOEcIGv8FLD9CAxzJ1b',
  fondoChicas: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8suyniP14wTrigZbLaMzpJ98vsFRf4t3NGXlYD',

  proveedor_1: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sWTbgy56FYtnUb9FshC0fzR3TIdZOS7wvKio2',
  proveedor_2: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8s4euMQmkVgY0BDkyfSqdUHo6KwtlzZmcPQiub',
  proveedor_3: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8s48h0ZykVgY0BDkyfSqdUHo6KwtlzZmcPQiub',
  proveedor_4: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sBFhOX6xjrVKINzH6pGQCwUniuAMcqbE4yZof',
  proveedor_5: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8ssnScN32Q2veqATUR7yWXE8xwNVbjnK14Jk39',
  proveedor_6: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sPIDsjRpmw9HCkhGpcuXJEAIVrQjOZK4LoBFY',

  tiktokBlanco: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8seBG6bnvysRjHlrwMLYDPQE315btg2xWd8G60',
  tiktokAzul: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sTTGVMH65KeOiU4LXd83ISyPV190oxtlaTb6w',
  facebookBlanco: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8seOyKsFwnvysRjHlrwMLYDPQE315btg2xWd8G',
  facebookAzul: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8s14u92s8NkUey2bmGzhC0vL9jsMZE8oWFAl6D',
  instaBlanco: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8s2mVj7SZg4tjwQNcDR1OVbrhqk8A95uCZI6Um',
  instaAzul: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sVosPtsJRaMO7N5j6SepguKW4UwLY0rI9CbP3',
  
  facebookDorado: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sJNZQUiSB8aFDCjyizfegp0H5ScOK9sP6xr1Q',
  instaDorado: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8su5BYTy4wTrigZbLaMzpJ98vsFRf4t3NGXlYD',
  tiktokDorado: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sTry7DZ65KeOiU4LXd83ISyPV190oxtlaTb6w',

  whatsapp: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8slgpfkKcHokc6ubKxfVeJILnXOBv04jFh5Cl8',
  direcion: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8s7aYp2pOWVTdwlY2nKaOEcIGv8FLD9CAxzJ1b',
  correo: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8s9Kj7985dR4IHVg7Ktlaopxz1QWsmZE5YXCjw',

  logo: 'https://gsxw2i31kz.ufs.sh/f/ad7xoTb5AU8sF1v08mDjHKQGs82Ok0694EcuvzTiLYUCPMqy'
};

const NAV_LINKS: { label: string; id: string }[] = [
  { label: 'INICIO',    id: 'inicio'    },
  { label: 'DESTINOS',  id: 'destinos'  },
  { label: 'NOSOTROS',  id: 'nosotros'  },
  { label: 'OPINIONES', id: 'opiniones' },
  { label: 'VIDEOBLOG', id: 'videoblog' },
  { label: 'CONTACTO',  id: 'contacto'  },
];

// ── Calendar helpers ─────────────────────────────────────────────────────────
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_ES   = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];

/** Devuelve array de strings YYYY-MM-DD (o null para celdas vacías) para un mes */
function getCalDays(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const total    = new Date(year, month + 1, 0).getDate();
  const days: (string | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= total; d++) {
    days.push(`${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }
  return days;
}

const fmtDisp = (iso: string) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ── ScrollTrigger thresholds (ajusta aquí para cambiar cuando disparan las animaciones) ──
const ST = {
  servicios:  'top 65%',  // Sección servicios
  destinos:   'top 65%',  // Título destinos
  nosotros:   'top 65%',  // Nosotros imagen + líneas de texto
  redes:      'top 65%',  // Redes: título + cards
  visitanos:  'top 65%',  // Visítanos: título
  visitanosD: 'top 65%',  // Visítanos: filas de info + mapa
};

const SERVICE_ITEMS = [
  { key: 'viajesNacionales',      label: 'VIAJES\nNACIONALES'      },
  { key: 'viajesInternacionales', label: 'VIAJES\nINTERNACIONALES' },
  { key: 'tours',                 label: 'TOURS'                   },
  { key: 'bodas',                 label: 'BODAS'                   },
  { key: 'lunaDeMiel',            label: 'LUNAS\nDE MIEL'          },
] as const;

const PROVIDERS = [
  ASSETS.proveedor_1, ASSETS.proveedor_2, ASSETS.proveedor_3,
  ASSETS.proveedor_4, ASSETS.proveedor_5, ASSETS.proveedor_6,
];

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://www.instagram.com/viajaentrenubes?igsh=MWE0MDNiZmloa3d1Zg==', white: ASSETS.instaBlanco,    gold: ASSETS.instaDorado,  blue: ASSETS.instaAzul  },
  { label: 'Facebook',  href: 'https://www.facebook.com/share/1CVYsnX9vF/?mibextid=wwXIfr',  white: ASSETS.facebookBlanco, gold: ASSETS.facebookDorado, blue: ASSETS.facebookAzul },
  { label: 'TikTok',   href: 'https://www.tiktok.com/@.viaja.entre.nube?_r=1&_t=ZS-95Zp4n5pON6e',  white: ASSETS.tiktokBlanco,   gold: ASSETS.tiktokDorado, blue: ASSETS.tiktokAzul  },
];

const TIKTOK_VIDEOS = [
  '7603106671564426514',
  '7593225003722706184',
  '7605719531742383367',
  '7564156991619239188'
];

// w = % del hero, top = % del hero, op = opacidad, dur = segundos por ciclo completo, flip = espejo visual
const CLOUD_LAYERS = [
  { w: 34, top:  5, op: 0.90, dur: 20, flip: false },  // grande, rápida, arriba
  { w: 22, top: 22, op: 0.65, dur: 36, flip: true  },  // mediana, lenta
  { w: 48, top: 48, op: 0.75, dur: 16, flip: false },  // grande, muy rápida, centro
  { w: 16, top: 12, op: 0.45, dur: 52, flip: false },  // pequeña, muy lenta
  { w: 38, top: 68, op: 0.80, dur: 22, flip: true  },  // grande, rápida, abajo
  { w: 26, top: 35, op: 0.55, dur: 40, flip: true  },  // mediana, lenta, centro
  { w: 14, top: 80, op: 0.40, dur: 60, flip: false },  // pequeñísima, ultra lenta
  { w: 42, top: 18, op: 0.70, dur: 18, flip: false },  // grande, rápida, casi arriba
] as const;

// ── Carousel constants ────────────────────────────────────────────────────────
const CARD_W   = 280;
const CARD_H   = 420;
const CARD_GAP = 24;

function cardScale(dist: number)   { return dist === 0 ? 1.1 : dist === 1 ? 0.88 : 0.72; }
function cardOpacity(dist: number) { return dist === 0 ? 1   : dist === 1 ? 0.75 : 0.35; }

// ── HotelCard — flip 3D ───────────────────────────────────────────────────────
function HotelCard({ hotel, waPhone, isCenter }: { hotel: LandingHotel; waPhone: string; isCenter: boolean }) {
  const innerRef   = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragging   = useRef(false);
  const images     = hotel.images.length > 0 ? hotel.images : [DEFAULT_HOTEL_IMG];
  const [imgIdx, setImgIdx] = useState(0);
  const currency = CURRENCIES[hotel.packageCurrency ?? 'MXN'] ?? hotel.packageCurrency ?? 'MXN';

  const waMsg = encodeURIComponent(
    `Hola! Me interesa cotizar:\n*${hotel.name}*\n${
      hotel.webDescription ? hotel.webDescription + '\n' : ''
    }${hotel.packagePrice != null
      ? `Precio: $${hotel.packagePrice.toLocaleString('es-MX')} ${hotel.packageCurrency ?? 'MXN'}`
      : ''}`
  );

  const flipTo = (deg: number) =>
    gsap.to(innerRef.current, { rotateY: deg, duration: 0.55, ease: 'power2.inOut', transformPerspective: 1000 });

  const isTouch = () => window.matchMedia('(hover: none)').matches;

  // Cuando la card deja de ser la central → resetea el flip
  useEffect(() => {
    if (!isCenter) flipTo(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCenter]);

  const slideImage = (newIdx: number, dir: 1 | -1) => {
    const wrap = imgWrapRef.current;
    if (!wrap || newIdx === imgIdx) return;
    const xOut = dir > 0 ? '-100%' : '100%';
    const xIn  = dir > 0 ?  '100%' : '-100%';
    gsap.to(wrap, {
      x: xOut, duration: 0.22, ease: 'power1.in',
      onComplete: () => {
        setImgIdx(newIdx);
        gsap.fromTo(wrap, { x: xIn }, { x: '0%', duration: 0.22, ease: 'power1.out' });
      },
    });
  };

  const prevImg = (e: React.MouseEvent) => { e.stopPropagation(); slideImage((imgIdx - 1 + images.length) % images.length, -1); };
  const nextImg = (e: React.MouseEvent) => { e.stopPropagation(); slideImage((imgIdx + 1) % images.length, 1); };

  const onPointerDown = (e: React.PointerEvent) => {
    dragStartX.current = e.clientX; dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    const diff = e.clientX - dragStartX.current;
    if (Math.abs(diff) > 35) slideImage(
      diff < 0 ? (imgIdx + 1) % images.length : (imgIdx - 1 + images.length) % images.length,
      diff < 0 ? 1 : -1,
    );
  };

  return (
    <div
      className="flex-shrink-0"
      style={{ width: CARD_W, height: CARD_H, perspective: '1000px' }}
      onMouseLeave={() => { if (isCenter && !isTouch()) flipTo(0); }}
    >
      <div ref={innerRef} style={{ width: '100%', height: '100%', transformStyle: 'preserve-3d', position: 'relative' }}>

        {/* ── FRENTE ── */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden bg-white shadow-xl flex flex-col"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Imagen — swipe + flechas + dots */}
          <div
            className="relative overflow-hidden flex-shrink-0 select-none"
            style={{ height: '56%' }}
            onPointerDown={images.length > 1 ? onPointerDown : undefined}
            onPointerUp={images.length > 1 ? onPointerUp : undefined}
          >
            <div ref={imgWrapRef} className="w-full h-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={toImgSrc(images[imgIdx])} alt={hotel.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
            </div>
            {images.length > 1 && (
              <>
                {/* <button onClick={prevImg} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none transition z-10">‹</button>
                <button onClick={nextImg} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/65 text-white w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none transition z-10">›w</button> */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {images.map((_, i) => (
                    <button key={i} onClick={(e) => { e.stopPropagation(); slideImage(i, i > imgIdx ? 1 : -1); }}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIdx ? 'bg-white scale-125' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Contenido — onMouseEnter dispara flip (solo card central) */}
          <div
            className={`flex flex-col gap-2 p-4 flex-1 min-h-0 select-none ${isCenter ? 'cursor-pointer' : ''}`}
            onMouseEnter={() => { if (isCenter && !isTouch()) flipTo(180); }}
            onClick={() => {
              if (isCenter && isTouch()) {
                const cur = (gsap.getProperty(innerRef.current, 'rotateY') as number) || 0;
                flipTo(Math.abs(cur) < 90 ? 180 : 0);
              }
            }}
          >
            <h3 className="text-[#0f2d5e] font-black text-sm uppercase tracking-wide leading-tight">{hotel.name}</h3>
            {hotel.webDescription && (
              <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-line line-clamp-3 flex-1">{hotel.webDescription}</p>
            )}
            {hotel.packagePrice != null && (
              <p className="text-[#0f2d5e] font-black text-2xl leading-none mt-auto">
                ${hotel.packagePrice.toLocaleString('es-MX')}{' '}
                <span className="text-sm font-semibold text-gray-400">{currency}</span>
              </p>
            )}
          </div>
        </div>

        {/* ── REVERSO ── */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden shadow-xl cursor-pointer"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          onClick={() => { if (isTouch()) flipTo(0); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={toImgSrc(images[imgIdx])} alt={hotel.name} className="absolute inset-0 w-full h-full object-cover" />
          {/* Capa base oscura uniforme en todo el reverso */}
          <div className="absolute inset-0 bg-black/50" />
          {/* Gradiente extra en la zona del texto (abajo) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-3">
            <p className="text-white font-black text-base uppercase tracking-widest text-center drop-shadow-lg">{hotel.name}</p>
            {hotel.packagePrice != null && (
              <p className="text-yellow-300 font-black text-xl text-center leading-none">
                ${hotel.packagePrice.toLocaleString('es-MX')}{' '}
                <span className="text-sm font-semibold">{currency}</span>
              </p>
            )}
            <a href={`https://wa.me/${waPhone}?text=${encodeURIComponent(`Hola! Me interesa cotizar el paquete: ${hotel.name} ✈️`)}`} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block text-center bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-[#0f2d5e] font-black text-sm tracking-widest uppercase py-3 rounded-xl shadow-lg transition">
              COTIZAR
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── TestimonialCard ───────────────────────────────────────────────────────────
function TestimonialCard({ t }: { t: LandingTestimonial }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-5 flex flex-col gap-3 h-full">
      {/* Header: avatar + nombre + estrellas */}
      <div className="flex items-center gap-3">
        {t.avatarUrl
          ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.avatarUrl} alt={t.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
          )
          : (
            <div className="w-11 h-11 rounded-full bg-blue-100 flex items-center justify-center text-[#1565c0] font-black text-lg flex-shrink-0">
              {t.name[0]?.toUpperCase()}
            </div>
          )
        }
        <div className="min-w-0">
          <p className="font-black text-[#1a1a2e] text-sm leading-tight truncate">{t.name}</p>
          <div className="flex items-center gap-0.5 mt-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className={`w-3.5 h-3.5 ${i < t.rating ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118L10 15.347l-3.952 2.878c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.064 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.285-3.957z"/>
              </svg>
            ))}
          </div>
        </div>
        {/* Ícono de fuente */}
        <div className="ml-auto flex-shrink-0">
          {t.source === 'facebook'
            ? (
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
              </svg>
            )
            : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )
          }
        </div>
      </div>

      {/* Texto */}
      <p className="text-gray-600 text-sm leading-relaxed line-clamp-5 flex-1">&ldquo;{t.text}&rdquo;</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function EntreNubesTemplate({ tenant }: { tenant: TenantLandingData }) {
  const heroRef      = useRef<HTMLElement>(null);
  const marcoWrapRef    = useRef<HTMLDivElement>(null);
  const marcoRef        = useRef<HTMLImageElement>(null);
  const persianaWrapRef = useRef<HTMLDivElement>(null);
  const persianaRef     = useRef<HTMLImageElement>(null);
  const airplaneRef  = useRef<HTMLImageElement>(null);
  const cloudsRef    = useRef<HTMLDivElement>(null);
  const textRef      = useRef<HTMLDivElement>(null);
  const heroCharsRef = useRef<HTMLSpanElement[]>([]);
  const searchRef    = useRef<HTMLDivElement>(null);
  const overlayRef   = useRef<HTMLDivElement>(null);
  const servicesRef  = useRef<HTMLElement>(null);
  const nosotrosRef    = useRef<HTMLElement>(null);
  const redesRef       = useRef<HTMLElement>(null);
  const visitanosRef   = useRef<HTMLElement>(null);

  // ── Navigation refs para Swiper ──────────────────────────────────────────
  const opinionPrevRef = useRef<HTMLButtonElement>(null);
  const opinionNextRef = useRef<HTMLButtonElement>(null);
  const videoPrevRef   = useRef<HTMLButtonElement>(null);
  const videoNextRef   = useRef<HTMLButtonElement>(null);

  // ── Carousel: Destinos + Buscados ─────────────────────────────────────────
  const destMasRef            = useRef<HTMLElement>(null);
  const destTrackContainerRef = useRef<HTMLDivElement>(null);
  const destTrackRef          = useRef<HTMLDivElement>(null);
  const cardSlotRefs          = useRef<(HTMLDivElement | null)[]>([]);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [activeNav, setActiveNav]     = useState(0);
  const [menuOpen, setMenuOpen]       = useState(false);

  // ── Datos del tenant (necesarios antes de callbacks) ────────────────────
  const hotels       = tenant.hotels ?? [];
  const testimonials = tenant.testimonials ?? [];
  const waPhone      = tenant.phone.replace(/\D/g, '');

  // ── Formulario de cotización ─────────────────────────────────────────────
  const [quoteDestino,  setQuoteDestino]  = useState('');
  const [quoteFechaIn,  setQuoteFechaIn]  = useState('');
  const [quoteFechaOut, setQuoteFechaOut] = useState('');
  const [quoteAdultos,  setQuoteAdultos]  = useState(1);
  const [quoteNinos,    setQuoteNinos]    = useState(0);

  // ── Dropdowns custom ─────────────────────────────────────────────────────
  const [destinoOpen,  setDestinoOpen]  = useState(false);
  const [destinoQuery, setDestinoQuery] = useState('');
  const [fechasOpen,   setFechasOpen]   = useState(false);
  const [hoverDate,   setHoverDate]   = useState('');
  const [calYear,     setCalYear]     = useState(() => new Date().getFullYear());
  const [calMonth,    setCalMonth]    = useState(() => new Date().getMonth());
  const destinoDropRef = useRef<HTMLDivElement>(null);
  const fechasDropRef  = useRef<HTMLDivElement>(null);

  // ── Modal cotización (mobile/tablet) ─────────────────────────────────────
  const [cotizaModal,      setCotizaModal]      = useState(false);
  const [mDestinoOpen,     setMDestinoOpen]     = useState(false);
  const [mDestinoQuery,    setMDestinoQuery]    = useState('');
  const [mFechasOpen,      setMFechasOpen]      = useState(false);
  const [mHoverDate,       setMHoverDate]       = useState('');
  const [mCalYear,         setMCalYear]         = useState(() => new Date().getFullYear());
  const [mCalMonth,        setMCalMonth]        = useState(() => new Date().getMonth());
  const mDestinoRef = useRef<HTMLDivElement>(null);
  const mFechasRef  = useRef<HTMLDivElement>(null);

  // ── Refs para el menú móvil ──────────────────────────────────────────────
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const bar1Ref       = useRef<HTMLSpanElement>(null);
  const bar2Ref       = useRef<HTMLSpanElement>(null);
  const bar3Ref       = useRef<HTMLSpanElement>(null);
  const menuItemsRef  = useRef<HTMLUListElement>(null);

  // ── Click fuera → cerrar dropdowns ──────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (destinoDropRef.current && !destinoDropRef.current.contains(e.target as Node)) {
        setDestinoOpen(false); setDestinoQuery('');
      }
      if (fechasDropRef.current && !fechasDropRef.current.contains(e.target as Node))
        setFechasOpen(false);
      if (mDestinoRef.current && !mDestinoRef.current.contains(e.target as Node)) {
        setMDestinoOpen(false); setMDestinoQuery('');
      }
      if (mFechasRef.current && !mFechasRef.current.contains(e.target as Node))
        setMFechasOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const prevMonth = useCallback(() => {
    setCalMonth(m => { if (m === 0) { setCalYear(y => y - 1); return 11; } return m - 1; });
  }, []);
  const nextMonth = useCallback(() => {
    setCalMonth(m => { if (m === 11) { setCalYear(y => y + 1); return 0; } return m + 1; });
  }, []);

  const handleDayClick = useCallback((iso: string) => {
    const today = new Date(); today.setHours(0,0,0,0);
    if (new Date(iso + 'T00:00:00') < today) return;
    if (!quoteFechaIn || (quoteFechaIn && quoteFechaOut)) {
      setQuoteFechaIn(iso); setQuoteFechaOut('');
    } else if (iso > quoteFechaIn) {
      setQuoteFechaOut(iso); setFechasOpen(false);
    } else {
      setQuoteFechaOut(quoteFechaIn); setQuoteFechaIn(iso); setFechasOpen(false);
    }
  }, [quoteFechaIn, quoteFechaOut]);

  const handleCotizar = useCallback(() => {
    const fmt = (d: string) => {
      if (!d) return '';
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y}`;
    };
    const lines = ['Hola! Me interesa cotizar un viaje ✈️'];
    if (quoteDestino)  lines.push(`*Destino:* ${quoteDestino}`);
    if (quoteFechaIn)  lines.push(`*Llegada:* ${fmt(quoteFechaIn)}`);
    if (quoteFechaOut) lines.push(`*Salida:*  ${fmt(quoteFechaOut)}`);
    lines.push(`*Adultos:* ${quoteAdultos}`);
    lines.push(`*Niños:*   ${quoteNinos}`);
    const msg = encodeURIComponent(lines.join('\n'));
    window.open(`https://wa.me/${waPhone}?text=${msg}`, '_blank');
  }, [quoteDestino, quoteFechaIn, quoteFechaOut, quoteAdultos, quoteNinos, waPhone]);

  const toggleMenu = useCallback(() => {
    const opening = !menuOpen;
    setMenuOpen(opening);

    const menu  = mobileMenuRef.current;
    const items = menuItemsRef.current?.children;

    if (opening) {
      // Abre: panel baja desde arriba
      gsap.fromTo(menu, { y: '-100%', opacity: 0 }, { y: '0%', opacity: 1, duration: 0.45, ease: 'power3.out' });
      // Items aparecen con stagger
      if (items) {
        gsap.fromTo(items,
          { y: -20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35, stagger: 0.07, ease: 'power3.out', delay: 0.15 }
        );
      }
      // Hamburger → X
      gsap.to(bar1Ref.current, { rotate: 45,  y: 8,  duration: 0.3, ease: 'power2.inOut' });
      gsap.to(bar2Ref.current, { opacity: 0,  x: 10, duration: 0.2 });
      gsap.to(bar3Ref.current, { rotate: -45, y: -8, duration: 0.3, ease: 'power2.inOut' });
    } else {
      // Cierra: panel sube
      gsap.to(menu, { y: '-100%', opacity: 0, duration: 0.35, ease: 'power3.in' });
      // X → Hamburger
      gsap.to(bar1Ref.current, { rotate: 0, y: 0, duration: 0.3, ease: 'power2.inOut' });
      gsap.to(bar2Ref.current, { opacity: 1, x: 0, duration: 0.2, delay: 0.1 });
      gsap.to(bar3Ref.current, { rotate: 0, y: 0, duration: 0.3, ease: 'power2.inOut' });
    }
  }, [menuOpen]);

  const scrollToSection = useCallback((id: string, idx: number) => {
    setActiveNav(idx);
    if (id === 'inicio') {
      gsap.to(window, { scrollTo: 0, duration: 1.1, ease: 'power3.inOut' });
      return;
    }
    const el = document.getElementById(id);
    if (!el) return;
    gsap.to(window, {
      scrollTo: { y: el, offsetY: 64 },   // 64px = altura del navbar fijo
      duration: 1.1,
      ease: 'power3.inOut',
    });
  }, []);

  const SLOT = CARD_W + CARD_GAP;

  const goToSlide = useCallback((idx: number) => {
    const clamped   = Math.max(0, Math.min(idx, hotels.length - 1));
    const container = destTrackContainerRef.current;
    const track     = destTrackRef.current;
    if (!container || !track) return;
    const trackX = container.offsetWidth / 2 - CARD_W / 2 - clamped * SLOT;
    gsap.to(track, { x: trackX, duration: 0.55, ease: 'power3.out' });
    cardSlotRefs.current.forEach((card, i) => {
      if (!card) return;
      const dist = Math.abs(i - clamped);
      gsap.to(card, { scale: cardScale(dist), opacity: cardOpacity(dist), duration: 0.45, ease: 'power2.out' });
    });
    setCarouselIdx(clamped);
  }, [hotels.length, SLOT]);

  useEffect(() => {
    if (hotels.length === 0) return;
    const id = setTimeout(() => goToSlide(0), 50);
    return () => clearTimeout(id);
  }, [goToSlide, hotels.length]);

  useEffect(() => {
    const onResize = () => goToSlide(carouselIdx);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [carouselIdx, goToSlide]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

    let isScrolling = false;
    const hero = heroRef.current!;

    const ctx = gsap.context(() => {

      // ── A0. Animación de entrada al cargar ───────────────────────────────
      // Solo animamos elementos que el scroll-tl NO controla (nav + letras).
      // El resto (clouds, airplane, marco, search) los deja el scroll-tl intactos.
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });

      // Navbar baja desde arriba
      intro.fromTo('nav',
        { y: -70, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6 },
        0
      );

      // Letras del título: suben con stagger elegante
      if (heroCharsRef.current.length > 0) {
        intro.fromTo(
          heroCharsRef.current,
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.55, stagger: 0.04 },
          0.25
        );
      }

      // ── A. Idle: avión flota ─────────────────────────────────────────────
      const planeIdle = gsap.to(airplaneRef.current, {
        y: -18, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });

      // ── B. Nubes infinitas izquierda → derecha ───────────────────────────
      const cloudEls = hero.querySelectorAll<HTMLImageElement>('.cloud-item');
      const vw = hero.offsetWidth;

      cloudEls.forEach((el) => {
        const dur  = parseFloat(el.dataset.dur  || '30');
        const flip = el.dataset.flip === 'true';
        const cw   = el.offsetWidth || (vw * parseFloat(el.dataset.wPct || '25') / 100);
        const total = vw + cw;  // distancia total: desde -cw hasta vw

        // Posición inicial aleatoria dentro del rango visible o justo entrando
        const startX = -cw + Math.random() * total;

        gsap.set(el, {
          x: startX,
          scaleX: flip ? -1 : 1,  // espejo visual (GSAP owner de todos los transforms)
        });

        // Animación LTR con modifiers para loop sin salto
        gsap.to(el, {
          x: `+=${total * 80}`,     // número grande → loops infinitos
          duration: dur * 80,
          repeat: -1,
          ease: 'none',
          modifiers: {
            // Mapea x a [-cw, vw): loop suave sin discontinuidad
            x: gsap.utils.unitize((x: number) => ((x + cw) % total) - cw),
          },
        });
      });

      // ── C. ScrollTrigger: zoom-through (NO TOCAR) ────────────────────────
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: heroRef.current,
          start: 'top top',
          end: '+=90%',
          scrub: 1.4,
          pin: true,
          onEnter:     () => { planeIdle.pause(); isScrolling = true;  },
          onLeaveBack: () => { planeIdle.play();  isScrolling = false; },
        },
      });

      // ── Persiana sube primero (primera mitad del scroll) ─────────────
      tl.to(persianaRef.current, {
        y: '-101%', ease: 'power2.inOut', duration: 0.45,
      }, 0);

      // ── Marco + persiana wrapper escalan juntos (zoom-through) ──────
      tl.to(marcoRef.current, {
        scale: 28, ease: 'power2.inOut', duration: 1, transformOrigin: '50% 50%',
      }, 0);
      tl.to(persianaWrapRef.current, {
        scale: 28, ease: 'power2.inOut', duration: 1, transformOrigin: '50% 50%',
      }, 0);

      tl.to(airplaneRef.current, {
        y: 220, scale: 0.55, opacity: 0, duration: 0.55, ease: 'power2.in',
      }, 0);

      // Fade/scale del contenedor de nubes (reemplaza nubes1 + nubes2)
      tl.to(cloudsRef.current, {
        scale: 1.9, opacity: 0, duration: 0.45, ease: 'power2.in',
      }, 0);

      tl.to(textRef.current, {
        y: -110, opacity: 0, duration: 0.35, ease: 'power2.in',
      }, 0);

      tl.to(searchRef.current, {
        y: 80, opacity: 0, duration: 0.3, ease: 'power2.in',
      }, 0);

      tl.to(overlayRef.current, {
        opacity: 1, duration: 0.25, ease: 'none',
      }, 0.75);

      // ── E. Servicios: stagger fade-in desde abajo ────────────────────────
      gsap.fromTo(
        servicesRef.current!.querySelectorAll('.service-item'),
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: servicesRef.current,
            start: ST.servicios,
            toggleActions: 'play none none reverse',
          },
        }
      );

      // ── F. Destinos + Buscados: solo el título (cards las controla el carousel) ──
      if (destMasRef.current) {
        gsap.fromTo(
          destMasRef.current.querySelector('.dest-title'),
          { y: 40, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: destMasRef.current, start: ST.destinos, toggleActions: 'play none none reverse' },
          }
        );
      }

      // ── G. Acerca de Nosotros: imagen desde izquierda + texto desde derecha ─
      if (nosotrosRef.current) {
        gsap.fromTo(
          nosotrosRef.current.querySelector('.nosotros-img'),
          { x: -70, opacity: 0 },
          {
            x: 0, opacity: 1, duration: 0.9, ease: 'power3.out',
            scrollTrigger: { trigger: nosotrosRef.current, start: ST.nosotros, toggleActions: 'play none none reverse' },
          }
        );
        gsap.fromTo(
          nosotrosRef.current.querySelectorAll('.nosotros-line'),
          { x: 50, opacity: 0 },
          {
            x: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.1,
            scrollTrigger: { trigger: nosotrosRef.current, start: ST.nosotros, toggleActions: 'play none none reverse' },
          }
        );
      }

      // ── H. Redes Sociales: cards suben con stagger ───────────────────────
      if (redesRef.current) {
        gsap.fromTo(
          redesRef.current.querySelector('.redes-title'),
          { y: 30, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.7, ease: 'power3.out',
            scrollTrigger: { trigger: redesRef.current, start: ST.redes, toggleActions: 'play none none reverse' },
          }
        );
        gsap.fromTo(
          redesRef.current.querySelectorAll('.redes-card'),
          { y: 60, opacity: 0, scale: 0.8 },
          {
            y: 0, opacity: 1, scale: 1,
            duration: 0.6, ease: 'back.out(1.5)', stagger: 0.15,
            scrollTrigger: { trigger: redesRef.current, start: ST.redes, toggleActions: 'play none none reverse' },
          }
        );
      }

      // ── I. Visítanos: info desde izquierda, mapa desde derecha ───────────
      if (visitanosRef.current) {
        gsap.fromTo(
          visitanosRef.current.querySelector('.visita-title'),
          { y: -30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out',
            scrollTrigger: { trigger: visitanosRef.current, start: ST.visitanos, toggleActions: 'play none none reverse' } }
        );
        gsap.fromTo(
          visitanosRef.current.querySelectorAll('.visita-row'),
          { x: -50, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.12,
            scrollTrigger: { trigger: visitanosRef.current, start: ST.visitanosD, toggleActions: 'play none none reverse' } }
        );
        gsap.fromTo(
          visitanosRef.current.querySelector('.visita-map'),
          { x: 60, opacity: 0 },
          { x: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: visitanosRef.current, start: ST.visitanosD, toggleActions: 'play none none reverse' } }
        );
      }

      // ── J. Nav activo al hacer scroll ───────────────────────────────────
      NAV_LINKS.forEach(({ id }, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 55%',
          onEnter:     () => setActiveNav(i),
          onEnterBack: () => setActiveNav(i),
        });
      });

    }, heroRef);

    // ── D. Mouse parallax (solo marco, avión y texto — no clouds) ─────────
    const onMouseMove = (e: MouseEvent) => {
      if (isScrolling) return;
      const rect = hero.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
      const my = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;

      gsap.to(marcoWrapRef.current, { x: mx * -10, y: my * -7, duration: 1.6, ease: 'power2.out' });
      gsap.to(airplaneRef.current,  { x: mx * 14,  y: my * 9,  duration: 1.5, ease: 'power2.out' });
      gsap.to(textRef.current,      { x: mx *  5,  y: my * 3,  duration: 1.8, ease: 'power2.out' });
    };

    hero.addEventListener('mousemove', onMouseMove);

    // ── Refresh tras carga completa de imágenes ──────────────────────────
    // En primera visita (sin caché) las imágenes cargan después de que GSAP
    // ya calculó posiciones. Esto las recalcula cuando todo está listo.
    const onFullLoad = () => ScrollTrigger.refresh();
    if (document.readyState === 'complete') {
      ScrollTrigger.refresh();
    } else {
      window.addEventListener('load', onFullLoad, { once: true });
    }

    return () => {
      ctx.revert();
      hero.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('load', onFullLoad);
    };
  }, []);

  // ── JSON-LD: Schema.org TravelAgency ────────────────────────────────────────
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: tenant.name,
    description: `Agencia de viajes ${tenant.name}. Paquetes nacionales, internacionales, tours, bodas y lunas de miel.`,
    url: typeof window !== 'undefined' ? window.location.origin : undefined,
    telephone: tenant.phone || undefined,
    email: tenant.email || undefined,
    address: tenant.address
      ? { '@type': 'PostalAddress', streetAddress: tenant.address }
      : undefined,
    image: tenant.logo || undefined,
    sameAs: [
      tenant.facebookReviewUrl,
      tenant.googleReviewUrl,
    ].filter(Boolean),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Paquetes de viaje',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Trip', name: 'Viajes Nacionales' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Trip', name: 'Viajes Internacionales' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Trip', name: 'Tours' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Trip', name: 'Bodas' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Trip', name: 'Lunas de Miel' } },
      ],
    },
  };

  return (
    <div className="font-sans bg-white">

      {/* ── JSON-LD para Google ───────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Navbar ───────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-8 py-3 bg-white shadow-lg">

        {/* Logo / nombre */}
        {tenant.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={tenant.logo} alt={tenant.name} className="h-12 md:h-14 object-contain" />
        ) : (
          <span className="text-xl font-bold text-blue-700">{tenant.name}</span>
        )}

        {/* Links desktop */}
        <ul className="hidden md:flex gap-8 text-xs font-bold tracking-widest">
          {NAV_LINKS.map(({ label, id }, i) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => scrollToSection(id, i)}
                className={`relative transition-colors hover:text-yellow-500 ${
                  activeNav === i ? 'text-yellow-500' : 'text-gray-700'
                }`}
              >
                {label}
                {activeNav === i && (
                  <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-yellow-500 rounded-full" />
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Botón hamburger — solo visible en móvil/tablet */}
        <button
          type="button"
          onClick={toggleMenu}
          aria-label="Abrir menú"
          className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-0 focus:outline-none"
        >
          <span ref={bar1Ref} className="block w-6 h-0.5 bg-[#0f1e3d] rounded-full origin-center" style={{ marginBottom: '5px' }} />
          <span ref={bar2Ref} className="block w-6 h-0.5 bg-[#0f1e3d] rounded-full" />
          <span ref={bar3Ref} className="block w-6 h-0.5 bg-[#0f1e3d] rounded-full origin-center" style={{ marginTop: '5px' }} />
        </button>
      </nav>

      {/* ── Panel menú móvil ─────────────────────────────────────────────── */}
      <div
        ref={mobileMenuRef}
        className="fixed top-0 left-0 right-0 z-40 md:hidden bg-[#0f1e3d] pt-20 pb-10 px-8 shadow-2xl"
        style={{ transform: 'translateY(-100%)', opacity: 0 }}
      >
        <ul ref={menuItemsRef} className="flex flex-col gap-1">
          {NAV_LINKS.map(({ label, id }, i) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => {
                  scrollToSection(id, i);
                  // Cerrar menú tras elegir sección
                  setTimeout(() => {
                    setMenuOpen(false);
                    gsap.to(mobileMenuRef.current, { y: '-100%', opacity: 0, duration: 0.35, ease: 'power3.in' });
                    gsap.to(bar1Ref.current, { rotate: 0, y: 0, duration: 0.3, ease: 'power2.inOut' });
                    gsap.to(bar2Ref.current, { opacity: 1, x: 0, duration: 0.2, delay: 0.1 });
                    gsap.to(bar3Ref.current, { rotate: 0, y: 0, duration: 0.3, ease: 'power2.inOut' });
                  }, 200);
                }}
                className={`w-full text-left py-4 text-lg font-bold tracking-widest border-b border-white/10 transition-colors hover:text-yellow-400 ${
                  activeNav === i ? 'text-yellow-400' : 'text-white'
                }`}
              >
                {label}
                {activeNav === i && (
                  <span className="ml-3 inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 align-middle" />
                )}
              </button>
            </li>
          ))}
        </ul>

        {/* Info de contacto rápido en el menú */}
        {(tenant.phone || tenant.email) && (
          <div className="mt-8 pt-6 border-t border-white/20 space-y-2">
            {tenant.phone && (
              <p className="text-white/60 text-sm">{tenant.phone}</p>
            )}
            {tenant.email && (
              <p className="text-white/60 text-sm">{tenant.email}</p>
            )}
          </div>
        )}
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        id="inicio"
        className="relative w-full overflow-hidden"
        style={{
          height: '100vh',
          paddingTop: '32px',
          // Gradiente: azul más claro abajo/centro, oscuro arriba/bordes
          background: 'radial-gradient(ellipse 120% 80% at 50% 110%, #2176d8 0%, #0d3d94 30%, #2242a0 60%, #061d63 100%)',
        }}
      >

        {/* ── Overlay negro para transición al final del scroll ───────────── */}
        <div
          ref={overlayRef}
          className="absolute inset-0 bg-white pointer-events-none"
          style={{ zIndex: 40, opacity: 0 }}
        />

        {/* ── Contenedor de nubes animadas ──────────────────────────────────
             overflow:hidden para que las nubes se corten al salir del hero */}
        <div
          ref={cloudsRef}
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ zIndex: 20 }}
        >
          {CLOUD_LAYERS.map((c, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={ASSETS.nubes}
              alt=""
              aria-hidden
              className="cloud-item absolute"
              style={{
                width: `${c.w}%`,
                top: `${c.top}%`,
                opacity: c.op,
                // left: 0 como punto de referencia; GSAP mueve con x
                left: 0,
              }}
              data-dur={c.dur}
              data-flip={String(c.flip)}
              data-w-pct={c.w}
            />
          ))}
        </div>

        {/* ── Elementos GSAP (wrapper original — no modificar) ──────────── */}
        <div className="h-full">
          {/* Texto hero */}
          <div
            ref={textRef}
            className="absolute left-10 top-[25%] md:top-1/2 -translate-y-1/2 text-white select-none"
            style={{ zIndex: 30 }}
          >
            {/* H1 oculto: indexable por Google, invisible para el usuario */}
            <h1 className="sr-only">{tenant.name} — Agencia de Viajes</h1>

            {/* H2 visible: texto animado del hero */}
            <h2 className="text-[clamp(2.5rem,6vw,5rem)] font-black leading-none uppercase drop-shadow-[0_4px_24px_rgba(0,0,0,0.55)]">
              {(() => {
                heroCharsRef.current = [];
                const lines: { text: string; yellow?: boolean }[] = [
                  { text: 'TU' },
                  { text: 'AVENTURA', yellow: true },
                  { text: 'COMIENZA' },
                  { text: 'AQUÍ.' },
                ];
                return lines.map((line, li) => (
                  <div key={li} className="overflow-hidden leading-[1.05]">
                    <span className={line.yellow ? 'text-yellow-400' : ''}>
                      {line.text.split('').map((ch, ci) => (
                        <span
                          key={ci}
                          ref={el => { if (el) heroCharsRef.current.push(el); }}
                          className="inline-block"
                          style={{ opacity: 0, transform: 'translateY(60px)' }}
                        >
                          {ch === ' ' ? '\u00A0' : ch}
                        </span>
                      ))}
                    </span>
                  </div>
                ));
              })()}
            </h2>
          </div>

          {/* ── Persiana — clip-path elipse = sólo visible dentro del marco ── */}
          <div
            ref={persianaWrapRef}
            className="absolute pointer-events-none"
            style={{
              zIndex: 24,          // debajo del marco (25) pero encima de nubes (20)
              width: '42%',
              maxWidth: '540px',
              aspectRatio: '1 / 1', // reserva espacio antes de que cargue la imagen
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              /*
               * clip-path: ellipse(rx ry at cx cy)
               * Ajusta estos valores para que el elipse coincida con la
               * abertura interior del marco. Los % son relativos al elemento.
               * 44% horizontal, 46% vertical, centrado ligeramente abajo (53%).
               */
              clipPath: 'ellipse(45% 45% at 50% 50%)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={persianaRef}
              src={ASSETS.persiana}
              alt=""
              aria-hidden
              className="w-full h-auto block"
            />
          </div>

          {/* Marco (ventana de avión) — GSAP lo escala x28 en scroll */}
          <div
            ref={marcoWrapRef}
            className="absolute pointer-events-none"
            style={{
              zIndex: 25,
              width: '42%',
              maxWidth: '540px',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={marcoRef}
              src={ASSETS.marco}
              alt="ventana de avión"
              className="w-full h-auto block"
              style={{ transformOrigin: '50% 50%' }}
            />
          </div>

          {/* Avión */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={airplaneRef}
            src={ASSETS.avion}
            alt="avión"
            className="absolute pointer-events-none bottom-[30%] md:bottom-[10%]"
            style={{
              zIndex: 30,
              width: '62%',
              maxWidth: '760px',
              left: '30%',
              transform: 'translateX(-10%)',
              filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.5))',
            }}
          />
        </div>

        {/* ── Logo — grid overlay (sibling del wrapper GSAP, no adentro) ──
             Usar col-start / row-start para reposicionar en responsive.
             pl-X / pr-X funcionan normal aquí (no absolute). ────────────── */}
        <div
          className="absolute inset-0 pointer-events-none grid grid-cols-2 grid-rows-3"
          style={{ zIndex: 31 }}
        >
          {/*
            Mobile  : col 1 / row 3 → esquina inferior-izquierda
            Desktop : col 2 / row 3 → esquina inferior-derecha
          */}
          <div className="col-span-2 col-start-1 row-start-3 flex items-center justify-center sm:col-span-1 sm:col-start-2 sm:justify-end sm:pr-16">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.logo}
              alt={tenant.name}
              className="h-20 sm:h-28 w-auto object-contain"
              draggable={false}
            />
          </div>
        </div>


        {/* ── Barra de cotización — solo desktop ─────────────────────── */}
        <div
          ref={searchRef}
          className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-4xl bg-white rounded-2xl shadow-2xl overflow-visible"
          style={{ zIndex: 30 }}
        >
          <div className="flex flex-wrap items-stretch divide-x divide-gray-100 divide-y sm:divide-y-0">

            {/* ── DESTINO custom dropdown ── */}
            <div ref={destinoDropRef} className="relative flex items-center gap-2 flex-1 min-w-[130px] px-4 py-3">
              <span className="text-base flex-shrink-0">📍</span>
              <button
                type="button"
                onClick={() => { setDestinoOpen(o => !o); setFechasOpen(false); }}
                className="w-full flex items-center justify-between gap-1 outline-none"
              >
                <span className={`text-[11px] font-bold uppercase tracking-widest truncate ${quoteDestino ? 'text-[#0f2d5e]' : 'text-gray-400'}`}>
                  {quoteDestino || 'DESTINO'}
                </span>
                <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${destinoOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
              </button>

              {destinoOpen && (() => {
                const filtered = hotels.filter(h =>
                  h.name.toLowerCase().includes(destinoQuery.toLowerCase())
                );
                return (
                  <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden flex flex-col">
                    {/* Buscador */}
                    <div className="px-3 pt-3 pb-2">
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/>
                        </svg>
                        <input
                          autoFocus
                          type="text"
                          value={destinoQuery}
                          onChange={e => setDestinoQuery(e.target.value)}
                          placeholder="Buscar destino..."
                          className="flex-1 text-[11px] font-medium text-gray-700 placeholder-gray-400 bg-transparent outline-none"
                        />
                        {destinoQuery && (
                          <button type="button" onClick={() => setDestinoQuery('')}
                            className="text-gray-400 hover:text-gray-600 transition">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Lista scrolleable */}
                    <div className="overflow-y-auto max-h-52 pb-1">
                      {!destinoQuery && (
                        <>
                          <button type="button"
                            onClick={() => { setQuoteDestino(''); setDestinoQuery(''); setDestinoOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-[11px] text-gray-400 hover:bg-gray-50 transition">
                            Todos los destinos
                          </button>
                          <div className="h-px bg-gray-100 mx-3 mb-1" />
                        </>
                      )}

                      {filtered.length === 0 ? (
                        <p className="px-4 py-3 text-[11px] text-gray-400 text-center">Sin resultados</p>
                      ) : (
                        filtered.map(h => (
                          <button key={h.id} type="button"
                            onClick={() => { setQuoteDestino(h.name); setDestinoQuery(''); setDestinoOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition flex items-center gap-2
                              ${quoteDestino === h.name ? 'bg-[#0f2d5e] text-white' : 'text-[#0f2d5e] hover:bg-blue-50'}`}>
                            {quoteDestino === h.name && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />}
                            {h.name}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── FECHAS custom calendar ── */}
            <div ref={fechasDropRef} className="relative flex items-center gap-2 flex-1 min-w-[160px] px-4 py-3">
              <span className="text-base flex-shrink-0">📅</span>
              <button
                type="button"
                onClick={() => { setFechasOpen(o => !o); setDestinoOpen(false); }}
                className="w-full flex items-center justify-between gap-1 outline-none"
              >
                <span className={`text-[11px] font-bold tracking-widest ${quoteFechaIn ? 'text-[#0f2d5e]' : 'text-gray-400 uppercase'}`}>
                  {quoteFechaIn
                    ? `${fmtDisp(quoteFechaIn)}${quoteFechaOut ? ` → ${fmtDisp(quoteFechaOut)}` : ' → ...'}`
                    : 'FECHAS'}
                </span>
                <svg className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform ${fechasOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
              </button>

              {fechasOpen && (() => {
                const todayIso = new Date().toISOString().split('T')[0];
                const days = getCalDays(calYear, calMonth);
                const rangeEnd = quoteFechaOut || (quoteFechaIn ? hoverDate : '');
                const [rangeA, rangeB] = quoteFechaIn && rangeEnd
                  ? [quoteFechaIn < rangeEnd ? quoteFechaIn : rangeEnd, quoteFechaIn < rangeEnd ? rangeEnd : quoteFechaIn]
                  : ['',''];

                return (
                  <div className="absolute bottom-full left-0 sm:left-1/2 sm:-translate-x-1/2 mb-2 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 w-[calc(100vw-3rem)] max-w-xs sm:w-72">
                    {/* Header mes */}
                    <div className="flex items-center justify-between mb-3">
                      <button type="button" onClick={prevMonth}
                        className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                      </button>
                      <span className="text-sm font-black text-[#0f2d5e] uppercase tracking-wide">
                        {MONTHS_ES[calMonth]} {calYear}
                      </span>
                      <button type="button" onClick={nextMonth}
                        className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition text-gray-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                    </div>

                    {/* Días de la semana */}
                    <div className="grid grid-cols-7 mb-1">
                      {DAYS_ES.map(d => (
                        <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
                      ))}
                    </div>

                    {/* Celdas */}
                    <div className="grid grid-cols-7">
                      {days.map((iso, idx) => {
                        if (!iso) return <div key={`e${idx}`} />;
                        const isPast   = iso < todayIso;
                        const isStart  = iso === quoteFechaIn;
                        const isEnd    = iso === quoteFechaOut;
                        const inRange  = rangeA && rangeB && iso > rangeA && iso < rangeB;
                        const isToday  = iso === todayIso;
                        return (
                          <button
                            key={iso}
                            type="button"
                            disabled={isPast}
                            onClick={() => handleDayClick(iso)}
                            onMouseEnter={() => setHoverDate(iso)}
                            onMouseLeave={() => setHoverDate('')}
                            className={[
                              'h-8 w-full text-xs font-semibold flex items-center justify-center transition',
                              isPast ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer',
                              isStart || isEnd
                                ? 'bg-[#0f2d5e] text-white rounded-full z-10 relative'
                                : inRange
                                  ? 'bg-blue-100 text-blue-800 rounded-none'
                                  : !isPast ? 'hover:bg-blue-50 rounded-full text-gray-700' : '',
                              isToday && !isStart && !isEnd ? 'font-black text-yellow-500' : '',
                            ].join(' ')}
                          >
                            {Number(iso.split('-')[2])}
                          </button>
                        );
                      })}
                    </div>

                    {/* Footer acciones */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <button type="button"
                        onClick={() => { setQuoteFechaIn(''); setQuoteFechaOut(''); }}
                        className="text-[11px] text-gray-400 hover:text-gray-600 transition font-medium">
                        Borrar fechas
                      </button>
                      {quoteFechaIn && !quoteFechaOut && (
                        <span className="text-[11px] text-blue-500 font-medium">Elige fecha de salida</span>
                      )}
                      {quoteFechaIn && quoteFechaOut && (
                        <button type="button" onClick={() => setFechasOpen(false)}
                          className="text-[11px] font-black text-[#0f2d5e] hover:text-blue-700 transition">
                          Confirmar ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* ── ADULTOS stepper ── */}
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="text-base flex-shrink-0">👥</span>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">ADT</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setQuoteAdultos(v => Math.max(1, v - 1))}
                  className="w-6 h-6 rounded-full border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-[#0f2d5e] flex items-center justify-center text-sm font-bold transition">−</button>
                <span className="w-5 text-center text-sm font-black text-[#0f2d5e]">{quoteAdultos}</span>
                <button type="button" onClick={() => setQuoteAdultos(v => v + 1)}
                  className="w-6 h-6 rounded-full border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-[#0f2d5e] flex items-center justify-center text-sm font-bold transition">+</button>
              </div>
            </div>

            {/* ── NIÑOS stepper ── */}
            <div className="flex items-center gap-2 px-4 py-3">
              <span className="text-base flex-shrink-0">🧒</span>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-bold uppercase tracking-widest text-gray-400">NIÑ</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setQuoteNinos(v => Math.max(0, v - 1))}
                  className="w-6 h-6 rounded-full border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-[#0f2d5e] flex items-center justify-center text-sm font-bold transition">−</button>
                <span className="w-5 text-center text-sm font-black text-[#0f2d5e]">{quoteNinos}</span>
                <button type="button" onClick={() => setQuoteNinos(v => v + 1)}
                  className="w-6 h-6 rounded-full border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-[#0f2d5e] flex items-center justify-center text-sm font-bold transition">+</button>
              </div>
            </div>

            {/* ── COTIZAR ── */}
            <button
              type="button"
              onClick={handleCotizar}
              className="bg-[#0f2d5e] hover:bg-blue-900 active:bg-blue-950 transition text-white text-xs font-black tracking-widest px-7 py-4 uppercase flex-shrink-0 w-full sm:w-auto rounded-b-2xl sm:rounded-b-none sm:rounded-r-2xl"
            >
              COTIZAR
            </button>
          </div>
        </div>

      </section>

      {/* ── Sección servicios ────────────────────────────────────────────── */}
      <section
        ref={servicesRef}
        className="bg-gray-100 py-14 px-6"
      >
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-8 sm:gap-12">
          {SERVICE_ITEMS.map(({ key, label }) => (
            <div
              key={key}
              className="service-item flex flex-col items-center gap-3 w-[120px] sm:w-[140px] cursor-pointer group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ASSETS[key]}
                alt={label.replace('\n', ' ')}
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain transition-transform duration-300 group-hover:scale-110"
              />
              <span className="text-center text-[10px] sm:text-xs font-black tracking-widest text-[#0f2d5e] leading-tight whitespace-pre-line">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Destinos + Buscados ──────────────────────────────────────────── */}
      {hotels.length > 0 && (
        <section ref={destMasRef} id="destinos" className="py-16 px-6">
          <div className="max-w-6xl mx-auto">

            {/* Title */}
            <h2 className="dest-title text-3xl sm:text-4xl font-black text-[#0f1e3d] text-center mb-10 uppercase tracking-wide opacity-0">
              DESTINOS <span className="text-yellow-400">+</span> BUSCADOS
            </h2>

            {/* Carousel wrapper */}
            <div className="relative my-auto">
              <div
                ref={destTrackContainerRef}
                style={{ height: CARD_H * 1.15 + 16, overflowX: 'clip', overflowY: 'visible' }}
              >
                <div
                  ref={destTrackRef}
                  className="flex items-center"
                  style={{ gap: CARD_GAP, paddingTop: 12, paddingBottom: 12 }}
                >
                  {hotels.map((hotel, i) => (
                    <div key={hotel.id} ref={(el) => { cardSlotRefs.current[i] = el; }}>
                      <HotelCard hotel={hotel} waPhone={waPhone} isCenter={i === carouselIdx} />
                    </div>
                  ))}
                </div>
              </div>

              {carouselIdx > 0 && (
                <button
                  onClick={() => goToSlide(carouselIdx - 1)}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#0f1e3d] hover:bg-white/40 backdrop-blur-sm text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl leading-none transition shadow-lg z-10"
                >‹</button>
              )}
              {carouselIdx < hotels.length - 1 && (
                <button
                  onClick={() => goToSlide(carouselIdx + 1)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#0f1e3d] hover:bg-white/40 backdrop-blur-sm text-white w-12 h-12 rounded-full flex items-center justify-center text-2xl leading-none transition shadow-lg z-10"
                >›</button>
              )}
            </div>

            {hotels.length > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {hotels.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goToSlide(i)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === carouselIdx ? 'bg-yellow-400 scale-125' : 'bg-[#0f1e3d]'
                    }`}
                  />
                ))}
              </div>
            )}

          </div>
        </section>
      )}

      {/* ── Acerca de Nosotros ───────────────────────────────────────────── */}
      <section
        ref={nosotrosRef}
        id="nosotros"
        className="relative overflow-hidden"
      >
        {/* Fondo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url(${ASSETS.fondoChicas})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
          }}
        />
        {/* Overlay general suave */}
        {/* <div className="absolute inset-0 bg-[#0a1a40]/60" /> */}

        {/* Contenido */}
        <div className="relative z-10 max-w-5xl mx-auto flex flex-col min-h-[740px]">

          {/* Título — fila completa arriba */}
          <div className="nosotros-line w-full text-center pt-12 pb-4 px-6">
            <h2 className="text-[#0f1e3d] text-4xl sm:text-5xl uppercase leading-none tracking-widest">
              ACERCA <span className="text-[#0f1e3d] font-black">DE NOSOTROS</span>
            </h2>
          </div>

          {/* Fila inferior: imagen + texto */}
          <div className="flex flex-col md:flex-row flex-1">

          {/* Imagen chicas — izquierda en desktop, ABAJO en mobile */}
          <div className="nosotros-img order-2 md:order-1 flex-shrink-0 w-full md:w-[42%] flex items-end justify-center pt-6 md:pt-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ASSETS.chicas}
              alt="Equipo Entre Nubes"
              className="w-100% w-auto object-contain object-bottom select-none"
              style={{ filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.55))' }}
              draggable={false}
            />
          </div>

          {/* Texto — derecha en desktop, ARRIBA en mobile */}
          <div className="order-1 md:order-2 flex-1 flex flex-col justify-center gap-5 px-8 md:px-12 py-10 md:py-16">

            <p className="nosotros-line text-white/80 text-xs sm:text-sm leading-relaxed uppercase tracking-wide max-w-lg">
              ENTRE NUBES NACIÓ DEL SUEÑO DE DOS CHICAS APASIONADAS POR VIAJAR,
              DESCUBRIR NUEVOS DESTINOS Y TRANSFORMAR CADA EXPERIENCIA EN UN RECUERDO
              INOLVIDABLE. CREEMOS QUE VIAJAR NO ES SOLO CAMBIAR DE LUGAR, SINO CAMBIAR
              DE PERSPECTIVA, CONECTAR Y CREAR MOMENTOS QUE SE QUEDAN PARA SIEMPRE.
            </p>

            <p className="nosotros-line text-white/80 text-xs sm:text-sm leading-relaxed uppercase tracking-wide max-w-lg">
              DISEÑAMOS VIAJES NACIONALES E INTERNACIONALES PENSADOS PARA CADA TIPO DE
              VIAJERO: ESCAPADAS ROMÁNTICAS, AVENTURAS CON AMIGOS, VIAJES FAMILIARES,
              LUNAS DE MIEL, CELEBRACIONES ESPECIALES Y HOTELES TODO INCLUIDO DONDE SOLO
              TE PREOCUPAS POR DISFRUTAR.
            </p>

            <p className="nosotros-line text-white/80 text-xs sm:text-sm leading-relaxed uppercase tracking-wide max-w-lg">
              EN ENTRE NUBES TRABAJAMOS CON PASIÓN, CERCANÍA Y COMPROMISO, PORQUE
              SABEMOS QUE DETRÁS DE CADA VIAJE HAY SUEÑOS, ILUSIONES Y PERSONAS QUE
              CONFÍAN EN NOSOTRAS.
            </p>

            <div className="nosotros-line mt-2 mx-auto">
              <p className="text-white font-black text-sm sm:text-lg uppercase leading-snug tracking-wide">
                "TÚ ELIGES EL DESTINO...<br />
                NOSOTRAS TE LLEVAMOS<br />
                <span className="text-white">Agencia de Viajes - Entre Nubes</span>"
              </p>
            </div>

          </div>

          </div>{/* fin fila inferior */}
        </div>
      </section>

      {/* ── Socios Comerciales — marquee infinito ───────────────────────── */}
      <section className="bg-[#0f1e3d] py-12">
        {/* Título */}
        <p className="text-center text-white text-lg uppercase mb-5">
          NUESTROS SOCIOS <span className="text-white font-black">COMERCIALES</span>
        </p>

        {/* Marquee CSS infinito — fade en bordes */}
        <div
          className="overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 14%, black 86%, transparent 100%)',
          }}
        >
          {/*
            El track tiene 4 copias de logos.
            Animamos de 0 → -50% (= 2 copias de ancho).
            Cuando reinicia visualmente está en el mismo punto → loop perfecto.
          */}
          <div className="marquee-track flex items-center gap-16 w-max">
            {[...PROVIDERS, ...PROVIDERS, ...PROVIDERS, ...PROVIDERS].map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`socio ${i % PROVIDERS.length + 1}`}
                className="h-32 sm:h-34 w-auto object-contain brightness-0 invert opacity-60 hover:opacity-100 transition-opacity select-none flex-shrink-0"
                draggable={false}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Lo que Opinan ───────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section id="opiniones" className="py-16 px-4" style={{ background: 'linear-gradient(135deg, #1565c0 0%, #1976d2 50%, #42a5f5 100%)' }}>
          {/* Título */}
          <div className="text-center mb-10">
            <p className="text-white/80 text-sm font-bold tracking-[0.25em] uppercase mb-1">LO QUE OPINAN</p>
            <h2 className="text-white font-black text-4xl sm:text-5xl uppercase leading-none tracking-wide">
              NUESTROS CLIENTES
            </h2>
          </div>

          {/* Swiper de testimonios */}
          <div className="max-w-6xl mx-auto relative px-6">
            <Swiper
              modules={[Autoplay, Navigation]}
              loop={testimonials.length > 2}
              autoplay={{ delay: 4500, disableOnInteraction: false, pauseOnMouseEnter: true }}
              navigation={{ prevEl: opinionPrevRef.current, nextEl: opinionNextRef.current }}
              onBeforeInit={(swiper) => {
                if (typeof swiper.params.navigation === 'object') {
                  swiper.params.navigation.prevEl = opinionPrevRef.current;
                  swiper.params.navigation.nextEl = opinionNextRef.current;
                }
              }}
              spaceBetween={24}
              breakpoints={{
                0:   { slidesPerView: 1 },
                640: { slidesPerView: 2 },
                1024:{ slidesPerView: 3 },
              }}
            >
              {testimonials.map((t) => (
                <SwiperSlide key={t.id}>
                  <TestimonialCard t={t} />
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Flechas custom */}
            <button ref={opinionPrevRef} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white text-[#1565c0] w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-xl font-bold hover:bg-blue-50 transition disabled:opacity-30">‹</button>
            <button ref={opinionNextRef} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white text-[#1565c0] w-10 h-10 rounded-full shadow-lg flex items-center justify-center text-xl font-bold hover:bg-blue-50 transition disabled:opacity-30">›</button>
          </div>

          {/* Botones de reseñas */}
          {(tenant.facebookReviewUrl || tenant.googleReviewUrl) && (
            <div className="flex flex-wrap justify-center gap-4 mt-10">
              {tenant.facebookReviewUrl && (
                <a
                  href={tenant.facebookReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white text-[#1a1a2e] font-black text-sm uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg hover:bg-blue-50 transition"
                >
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
                  OPINIONES EN FACEBOOK
                </a>
              )}
              {tenant.googleReviewUrl && (
                <a
                  href={tenant.googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 bg-white text-[#1a1a2e] font-black text-sm uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg hover:bg-gray-50 transition"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  OPINIONES EN GOOGLE
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Videoblog ────────────────────────────────────────────────────── */}
      <section id="videoblog" className="py-16 bg-white overflow-hidden">
        {/* Título */}
        <div className="text-center mb-10">
          <p className="text-[#0f2d5e]/50 text-sm font-bold tracking-[0.25em] uppercase mb-1">CONOCE MÁS</p>
          <h2 className="text-[#0f2d5e] font-black text-4xl sm:text-5xl uppercase leading-none tracking-wide">
            NUESTRO <span style={{ color: '#1565c0' }}>VIDEOBLOG</span>
          </h2>
        </div>

        {/* Swiper de videos */}
        <div className="relative max-w-5xl mx-auto px-14">
          <Swiper
            modules={[Autoplay, Navigation]}
            centeredSlides
            slidesPerView="auto"
            spaceBetween={20}
            navigation={{ prevEl: videoPrevRef.current, nextEl: videoNextRef.current }}
            onBeforeInit={(swiper) => {
              if (typeof swiper.params.navigation === 'object') {
                swiper.params.navigation.prevEl = videoPrevRef.current;
                swiper.params.navigation.nextEl = videoNextRef.current;
              }
            }}
          >
            {TIKTOK_VIDEOS.map((videoId) => (
              <SwiperSlide key={videoId} style={{ width: 350 }}>
                <div className="rounded-2xl overflow-hidden shadow-xl border border-gray-100">
                  <iframe
                    src={`https://www.tiktok.com/embed/v2/${videoId}`}
                    style={{ width: '350px', height: '750px', border: 'none', display: 'block' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={`TikTok video ${videoId}`}
                  />
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          <button ref={videoPrevRef} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white text-[#0f2d5e] w-11 h-11 rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-2xl font-bold hover:bg-gray-50 transition disabled:opacity-30">‹</button>
          <button ref={videoNextRef} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white text-[#0f2d5e] w-11 h-11 rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-2xl font-bold hover:bg-gray-50 transition disabled:opacity-30">›</button>
        </div>
      </section>

      {/* ── Redes Sociales ───────────────────────────────────────────────── */}
      <section ref={redesRef} id="redes" className="py-20 px-4" style={{ background: '#dde5ef' }}>
        {/* Título */}
        <div className="redes-title text-center mb-14">
          <h2 className="text-[#0f2d5e] font-black text-4xl sm:text-5xl uppercase leading-none tracking-wide">
            NUESTRAS <span style={{ color: '#1565c0' }}>REDES SOCIALES</span>
          </h2>
        </div>

        {/* Cards */}
        <div className="flex flex-wrap justify-center gap-8 sm:gap-12">
          {SOCIAL_LINKS.map(({ label, href, white, gold }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="redes-card group flex flex-col items-center gap-4"
            >
              {/* Icono */}
              <div
                className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl flex items-center justify-center shadow-lg transition-all duration-400 overflow-hidden"
                style={{ background: '#42b4e6', transition: 'background 0.35s ease, transform 0.35s ease, box-shadow 0.35s ease' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = '#0f2d5e';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-6px) scale(1.07)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 40px rgba(15,45,94,0.35)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = '#42b4e6';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0) scale(1)';
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                }}
              >
                {/* Icono blanco (default) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={white}
                  alt={label}
                  className="absolute w-16 h-16 sm:w-20 sm:h-20 object-contain transition-opacity duration-350 group-hover:opacity-0"
                  draggable={false}
                />
                {/* Icono dorado (hover) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gold}
                  alt={label}
                  className="absolute w-16 h-16 sm:w-20 sm:h-20 object-contain opacity-0 transition-opacity duration-350 group-hover:opacity-100"
                  draggable={false}
                />
              </div>

              {/* Label */}
              <span className="text-[#0f2d5e] font-black text-sm uppercase tracking-widest transition-colors duration-300 group-hover:text-[#1565c0]">
                {label}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* ── Sección destinos ─────────────────────────────────────────────── */}
      {/* <section id="destinos" className="min-h-screen bg-white flex items-center justify-center px-10 py-28">
        <div className="max-w-4xl text-center">
          <h2 className="text-4xl font-bold text-gray-800 mb-6">Nuestros Destinos</h2>
          <p className="text-xl text-gray-500 leading-relaxed">
            Explora el mundo con {tenant.name}.<br />
            Diseñamos cada viaje a tu medida.
          </p>
        </div>
      </section> */}

      {/* ── Visítanos ────────────────────────────────────────────────────── */}
      <section
        ref={visitanosRef}
        id="contacto"
        className="py-16 px-4 sm:px-8 overflow-hidden"
        style={{ background: '#0f2d5e' }}
      >
        {/* Título */}
        <div className="visita-title text-center mb-12">
          <h2 className="text-white font-black text-4xl sm:text-5xl uppercase tracking-widest">
            VISÍTANOS
          </h2>
        </div>

        {/* Grid: info + mapa */}
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-10 lg:gap-16 items-start">

          {/* Columna izquierda — info de contacto */}
          <div className="flex-1 flex flex-col gap-6 min-w-0">

            {/* Dirección */}
            <div className="visita-row flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.direcion} alt="Dirección" className="w-10 h-10 object-contain flex-shrink-0 mt-0.5" draggable={false} />
              <div>
                {/* <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Dirección</p> */}
                <p className="text-white text-sm leading-relaxed uppercase">
                  AV. JUAN SABINES GUTIÉRREZ 1336, ZONA SIN ASIGNACIÓN DE NOMBRE. COL 39, C.P. 29075. TUXTLA GUTIÉRREZ, CHIAPAS.
                </p>
              </div>
            </div>

            {/* Email */}
            <div className="visita-row flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.correo} alt="Correo" className="w-10 h-10 object-contain flex-shrink-0 mt-0.5" draggable={false} />
              <div>
                {/* <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Correo</p> */}
                <a href={`mailto:ENTRENUBES.AGENCIA01@GMAIL.COM`} className="text-white text-sm hover:text-yellow-300 transition-colors">
                  ENTRENUBES.AGENCIA01@GMAIL.COM
                </a><br />
                <a href={`mailto:ENTRENUBES.AGENCIA02@GMAIL.COM`} className="text-white text-sm hover:text-yellow-300 transition-colors">
                  ENTRENUBES.AGENCIA02@GMAIL.COM
                </a>
              </div>
            </div>

            {/* Teléfono / WhatsApp */}
            <div className="visita-row flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ASSETS.whatsapp} alt="Teléfono" className="w-10 h-10 object-contain flex-shrink-0 mt-0.5" draggable={false} />
              <div>
                {/* <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-1">Teléfono / WhatsApp</p> */}
                <a
                  href={`https://wa.me/+529614521079`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white text-sm hover:text-yellow-300 transition-colors"
                >
                  961 452 1079
                </a><br />
                <a
                  href={`https://wa.me/+529611977391`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white text-sm hover:text-yellow-300 transition-colors"
                >
                  961 197 7391
                </a>
              </div>
            </div>

            {/* Botón Google Maps */}
            <div className="visita-row mt-2">
              <a
                href="https://maps.app.goo.gl/7c3Kvh5rAZUuBWDE8"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-[#0f2d5e] font-black text-xs uppercase tracking-widest px-6 py-3 rounded-xl shadow-lg transition"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                ABRIR EN GOOGLE MAPS
              </a>
            </div>
          </div>

          {/* Columna derecha — mapa */}
          <div className="visita-map w-full lg:w-[55%] rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4701.193794497539!2d-93.09250052409865!3d16.744170221014787!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x85ed27f25895e541%3A0x3d5e748cbde7770a!2sEntre%20Nubes!5e1!3m2!1ses-419!2smx!4v1776312993659!5m2!1ses-419!2smx"
              width="100%"
              height="380"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación Entre Nubes"
            />
          </div>

        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ background: '#0a1d3a' }}>
        {/* Banda principal */}
        <div className="relative overflow-hidden">
          {/* Avión watermark */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* <img
            src={ASSETS.avion}
            alt=""
            aria-hidden
            className="absolute right-[28%] top-1/2 -translate-y-1/2 w-48 sm:w-64 opacity-[0.07] pointer-events-none select-none"
            draggable={false}
          /> */}

          <div className="relative z-10 max-w-6xl mx-auto flex flex-col sm:flex-row items-center sm:items-stretch justify-between gap-8 px-8 py-10">

            {/* Logo */}
            <div className="flex items-center justify-center sm:justify-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={ASSETS.logo}
                alt={tenant.name}
                className="h-20 sm:h-24 w-auto object-contain"
                draggable={false}
              />
            </div>

            {/* Divisor vertical (solo sm+) */}
            {/* <div className="hidden sm:block w-px bg-white/10 self-stretch" /> */}

            {/* Contáctanos */}
            <div className="flex flex-col items-center sm:items-end justify-center gap-4">
              <p className="text-white font-black text-lg uppercase tracking-widest">CONTÁCTANOS</p>

              {/* Iconos dorados */}
              <div className="flex items-center gap-4">
                {SOCIAL_LINKS.map(({ label, href, blue }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-full flex items-center justify-center transition hover:scale-110 hover:brightness-110 bg-yellow-400"
                    
                    aria-label={label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={blue} alt={label} className="w-10 h-10 object-contain" draggable={false} />
                  </a>
                ))}
              </div>

              {/* Email */}
              <a
                href={`mailto:ENTRENUBES.AGENCIA01@GMAIL.COM`}
                className="text-white/60 text-xs uppercase tracking-wide hover:text-yellow-300 transition-colors"
              >
                ENTRENUBES.AGENCIA01@GMAIL.COM
              </a>
              <a
                href={`mailto:ENTRENUBES.AGENCIA02@GMAIL.COM`}
                className="text-white/60 text-xs uppercase tracking-wide hover:text-yellow-300 transition-colors"
              >
                ENTRENUBES.AGENCIA02@GMAIL.COM
              </a>
            </div>

          </div>
        </div>

        {/* Barra inferior */}
        <div className="border-t border-white/10 py-8 text-center bg-white">
          <p className="text-[#0a1d3a] text-[10px] sm:text-xs uppercase">
            {tenant.name.toUpperCase()} AGENCIA DE VIAJES&nbsp;&nbsp;|&nbsp;&nbsp;TODOS LOS DERECHOS RESERVADOS
          </p>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════════════
          BOTÓN FLOTANTE + MODAL COTIZACIÓN — solo mobile / tablet (md:hidden)
          ══════════════════════════════════════════════════════════════════ */}

      {/* Botón flotante */}
      <button
        type="button"
        onClick={() => setCotizaModal(true)}
        className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-[#0f2d5e] hover:bg-blue-900 active:bg-blue-950 text-white font-black text-xs uppercase tracking-widest px-6 py-3.5 rounded-full shadow-2xl transition"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
        </svg>
        Cotizar viaje
      </button>

      {/* Modal backdrop */}
      {cotizaModal && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setCotizaModal(false); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md h-[80%] my-auto overflow-hidden">

            {/* Header modal */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#0f2d5e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
                <h2 className="text-base font-black text-[#0f2d5e] uppercase tracking-wide">Cotizar viaje</h2>
              </div>
              <button type="button" onClick={() => setCotizaModal(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* ── DESTINO ── */}
              <div ref={mDestinoRef} className="relative">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Destino</label>
                <button type="button"
                  onClick={() => { setMDestinoOpen(o => !o); setMFechasOpen(false); }}
                  className="w-full flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-xl px-4 py-3 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span>📍</span>
                    <span className={`text-sm font-bold uppercase tracking-wide truncate ${quoteDestino ? 'text-[#0f2d5e]' : 'text-gray-400'}`}>
                      {quoteDestino || 'Selecciona un destino'}
                    </span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${mDestinoOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
                </button>

                {mDestinoOpen && (() => {
                  const filtered = hotels.filter(h => h.name.toLowerCase().includes(mDestinoQuery.toLowerCase()));
                  return (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
                      {/* Buscador */}
                      <div className="px-3 pt-3 pb-2">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z"/></svg>
                          <input autoFocus type="text" value={mDestinoQuery}
                            onChange={e => setMDestinoQuery(e.target.value)}
                            placeholder="Buscar destino..."
                            className="flex-1 text-[11px] font-medium text-gray-700 placeholder-gray-400 bg-transparent outline-none"/>
                          {mDestinoQuery && (
                            <button type="button" onClick={() => setMDestinoQuery('')} className="text-gray-400">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/></svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overflow-y-auto max-h-44 pb-1">
                        {!mDestinoQuery && (
                          <button type="button" onClick={() => { setQuoteDestino(''); setMDestinoQuery(''); setMDestinoOpen(false); }}
                            className="w-full text-left px-4 py-2.5 text-[11px] text-gray-400 hover:bg-gray-50 transition">Todos los destinos</button>
                        )}
                        {filtered.length === 0
                          ? <p className="px-4 py-3 text-[11px] text-gray-400 text-center">Sin resultados</p>
                          : filtered.map(h => (
                            <button key={h.id} type="button"
                              onClick={() => { setQuoteDestino(h.name); setMDestinoQuery(''); setMDestinoOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wide transition flex items-center gap-2 ${quoteDestino === h.name ? 'bg-[#0f2d5e] text-white' : 'text-[#0f2d5e] hover:bg-blue-50'}`}>
                              {quoteDestino === h.name && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0"/>}
                              {h.name}
                            </button>
                          ))
                        }
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── FECHAS ── */}
              <div ref={mFechasRef} className="relative">
                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Fechas</label>
                <button type="button"
                  onClick={() => { setMFechasOpen(o => !o); setMDestinoOpen(false); }}
                  className="w-full flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 hover:border-blue-300 rounded-xl px-4 py-3 transition"
                >
                  <div className="flex items-center gap-2">
                    <span>📅</span>
                    <span className={`text-sm font-bold ${quoteFechaIn ? 'text-[#0f2d5e]' : 'text-gray-400'}`}>
                      {quoteFechaIn ? `${fmtDisp(quoteFechaIn)}${quoteFechaOut ? ` → ${fmtDisp(quoteFechaOut)}` : ' → ...'}` : 'Selecciona fechas'}
                    </span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${mFechasOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd"/></svg>
                </button>

                {mFechasOpen && (() => {
                  const todayIso = new Date().toISOString().split('T')[0];
                  const days     = getCalDays(mCalYear, mCalMonth);
                  const rangeEnd = quoteFechaOut || (quoteFechaIn ? mHoverDate : '');
                  const [rangeA, rangeB] = quoteFechaIn && rangeEnd
                    ? [quoteFechaIn < rangeEnd ? quoteFechaIn : rangeEnd, quoteFechaIn < rangeEnd ? rangeEnd : quoteFechaIn]
                    : ['',''];
                  const mPrevMonth = () => setMCalMonth(m => { if (m === 0) { setMCalYear(y => y - 1); return 11; } return m - 1; });
                  const mNextMonth = () => setMCalMonth(m => { if (m === 11) { setMCalYear(y => y + 1); return 0; } return m + 1; });

                  return (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <button type="button" onClick={mPrevMonth} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition text-gray-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <span className="text-sm font-black text-[#0f2d5e] uppercase tracking-wide">{MONTHS_ES[mCalMonth]} {mCalYear}</span>
                        <button type="button" onClick={mNextMonth} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition text-gray-500">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-7 mb-1">
                        {DAYS_ES.map(d => <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>)}
                      </div>
                      <div className="grid grid-cols-7">
                        {days.map((iso, idx) => {
                          if (!iso) return <div key={`me${idx}`}/>;
                          const isPast  = iso < todayIso;
                          const isStart = iso === quoteFechaIn;
                          const isEnd   = iso === quoteFechaOut;
                          const inRange = rangeA && rangeB && iso > rangeA && iso < rangeB;
                          const isToday = iso === todayIso;
                          return (
                            <button key={iso} type="button" disabled={isPast}
                              onClick={() => handleDayClick(iso)}
                              onMouseEnter={() => setMHoverDate(iso)}
                              onMouseLeave={() => setMHoverDate('')}
                              className={['h-9 w-full text-xs font-semibold flex items-center justify-center transition',
                                isPast ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer',
                                isStart || isEnd ? 'bg-[#0f2d5e] text-white rounded-full z-10 relative' : inRange ? 'bg-blue-100 text-blue-800 rounded-none' : !isPast ? 'hover:bg-blue-50 rounded-full text-gray-700' : '',
                                isToday && !isStart && !isEnd ? 'font-black text-yellow-500' : '',
                              ].join(' ')}>
                              {Number(iso.split('-')[2])}
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <button type="button" onClick={() => { setQuoteFechaIn(''); setQuoteFechaOut(''); }}
                          className="text-[11px] text-gray-400 hover:text-gray-600 transition font-medium">Borrar fechas</button>
                        {quoteFechaIn && !quoteFechaOut && <span className="text-[11px] text-blue-500 font-medium">Elige fecha de salida</span>}
                        {quoteFechaIn && quoteFechaOut && (
                          <button type="button" onClick={() => setMFechasOpen(false)}
                            className="text-[11px] font-black text-[#0f2d5e] hover:text-blue-700 transition">Confirmar ✓</button>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* ── ADULTOS + NIÑOS en fila ── */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">👥 Adultos</p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuoteAdultos(v => Math.max(1, v - 1))}
                      className="w-8 h-8 rounded-full border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-[#0f2d5e] flex items-center justify-center font-bold text-lg transition">−</button>
                    <span className="flex-1 text-center text-xl font-black text-[#0f2d5e]">{quoteAdultos}</span>
                    <button type="button" onClick={() => setQuoteAdultos(v => v + 1)}
                      className="w-8 h-8 rounded-full border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-[#0f2d5e] flex items-center justify-center font-bold text-lg transition">+</button>
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">🧒 Niños</p>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuoteNinos(v => Math.max(0, v - 1))}
                      className="w-8 h-8 rounded-full border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-[#0f2d5e] flex items-center justify-center font-bold text-lg transition">−</button>
                    <span className="flex-1 text-center text-xl font-black text-[#0f2d5e]">{quoteNinos}</span>
                    <button type="button" onClick={() => setQuoteNinos(v => v + 1)}
                      className="w-8 h-8 rounded-full border border-gray-200 hover:border-blue-300 text-gray-500 hover:text-[#0f2d5e] flex items-center justify-center font-bold text-lg transition">+</button>
                  </div>
                </div>
              </div>

              {/* ── COTIZAR ── */}
              <button type="button" onClick={() => { handleCotizar(); setCotizaModal(false); }}
                className="w-full bg-[#0f2d5e] hover:bg-blue-900 active:bg-blue-950 transition text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl shadow-lg flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                Cotizar por WhatsApp
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
