import { Capabilities, Examples, FinalCta, Hero, HowItWorks, SiteFooter, SiteHeader, Trust } from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Capabilities />
        <HowItWorks />
        <Examples />
        <Trust />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
