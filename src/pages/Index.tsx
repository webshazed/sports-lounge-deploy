import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import AboutSection from "@/components/AboutSection";
import MemberBenefits from "@/components/MemberBenefits";
import LoungeExperience from "@/components/LoungeExperience";
import MembershipSection from "@/components/MembershipSection";
import SportsGroupSection from "@/components/SportsGroupSection";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroSection />
      <AboutSection />
      <MemberBenefits />
      <LoungeExperience />
      <MembershipSection />
      <SportsGroupSection />
      <FinalCTA />
      <Footer />
    </div>
  );
};

export default Index;
