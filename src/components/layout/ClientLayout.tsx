import Navigation from './Navigation';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import MigrationBanner from '@/components/migration/MigrationBanner';
import StoragePersistence from './StoragePersistence';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="max-w-2xl mx-auto pt-[env(safe-area-inset-top)] pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:pt-0 md:pb-0 md:ml-52">
        {children}
      </div>
      <Navigation />
      <OnboardingModal />
      <MigrationBanner />
      <StoragePersistence />
    </>
  );
}
