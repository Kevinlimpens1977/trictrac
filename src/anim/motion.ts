/** Gedeelde check voor bewegingsvoorkeur: alle GSAP-gameplay-animaties
 *  slaan zichzelf over wanneer de gebruiker reduced motion vraagt. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
