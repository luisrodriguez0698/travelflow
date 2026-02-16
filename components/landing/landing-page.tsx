'use client';

import { LandingNavbar } from './landing-navbar';
import { HeroSection } from './hero-section';
import { FeaturesSection } from './features-section';
import { StatsSection } from './stats-section';
import { HowItWorksSection } from './how-it-works-section';
import { TestimonialsSection } from './testimonials-section';
import { CtaSection } from './cta-section';
import { LandingFooter } from './landing-footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <LandingNavbar />
      <HeroSection />
      <FeaturesSection />
      <StatsSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <CtaSection />
      <LandingFooter />
    </div>
  );
}
