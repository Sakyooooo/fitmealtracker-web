import Navigation from './Navigation';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import MigrationBanner from '@/components/migration/MigrationBanner';
import StoragePersistence from './StoragePersistence';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="max-w-2xl mx-auto pb-20 md:pb-0 md:ml-52">
        {children}
      </div>
      <Navigation />
      <OnboardingModal />
      <MigrationBanner />
      <StoragePersistence />
    </>
  );
}
