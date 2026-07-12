import Navigation from './Navigation';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import RestoreGate from '@/components/onboarding/RestoreGate';
import MigrationBanner from '@/components/migration/MigrationBanner';
import StoragePersistence from './StoragePersistence';
import DailyRecapAutoTrigger from '@/components/recap/DailyRecapAutoTrigger';
import MealReminderScheduler from '@/components/notification/MealReminderScheduler';
import { AppDataProvider } from '@/store/AppDataProvider';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <div className="max-w-2xl mx-auto pt-[env(safe-area-inset-top)] pb-[calc(5rem_+_env(safe-area-inset-bottom))] md:pt-0 md:pb-0 md:ml-52">
        {children}
      </div>
      <Navigation />
      <RestoreGate />
      <OnboardingModal />
      <MigrationBanner />
      <StoragePersistence />
      <DailyRecapAutoTrigger />
      <MealReminderScheduler />
    </AppDataProvider>
  );
}
