'use client';

import { LandingNavbar } from './landing-navbar';
import { HeroSection } from './hero-section';
import { MarqueeStrip } from './marquee-strip';
import { FeaturesSection } from './features-section';
import { ShowcaseSection } from './showcase-section';
import { NotificationsSection } from './notifications-section';
import { StatsSection } from './stats-section';
import { HowItWorksSection } from './how-it-works-section';
import { TestimonialsSection } from './testimonials-section';
import { CtaSection } from './cta-section';
import { LandingFooter } from './landing-footer';
import { ScrollPilo, ScrollProgress } from './scroll-pilo';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 overflow-x-clip">
      <ScrollProgress />
      <LandingNavbar />
      <HeroSection />
      <MarqueeStrip />
      <FeaturesSection />
      <ShowcaseSection />
      <NotificationsSection />
      <StatsSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CtaSection />
      <LandingFooter />
      {/* Pilo acompaña el recorrido por la pagina */}
      <ScrollPilo />
    </div>
  );
}
