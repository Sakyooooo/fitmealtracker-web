import Navigation from './Navigation';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import RestoreGate from '@/components/onboarding/RestoreGate';
import MigrationBanner from '@/components/migration/MigrationBanner';
import StoragePersistence from './StoragePersistence';
import DailyRecapAutoTrigger from '@/components/recap/DailyRecapAutoTrigger';
import WeeklyGymReviewTrigger from '@/components/friends/WeeklyGymReviewTrigger';
import MealReminderScheduler from '@/components/notification/MealReminderScheduler';
import { AppDataProvider } from '@/store/AppDataProvider';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      {/*
        pb は下部固定ナビ(Navigation.tsx)ぶんの余白。ナビの実高さ(py-2 8px×2 +
        アイコン22px + gap 2px + ラベル約14px ≈ 56px = 3.5rem)と一致させること。
        ずれると各ページ側の min-h-[calc(100svh_-_...)] 計算（friends/meal/exercise
        page.tsx）と噛み合わなくなり、bodyの二重スクロール(固定ナビがスクロール中に
        ずれる不具合の原因)か、逆に隙間が見える、のどちらかになる。
      */}
      <div className="max-w-2xl mx-auto pt-[env(safe-area-inset-top)] pb-[calc(3.5rem_+_env(safe-area-inset-bottom))] md:pt-0 md:pb-0 md:ml-52">
        {children}
      </div>
      <Navigation />
      <RestoreGate />
      <OnboardingModal />
      <MigrationBanner />
      <StoragePersistence />
      <DailyRecapAutoTrigger />
      <WeeklyGymReviewTrigger />
      <MealReminderScheduler />
    </AppDataProvider>
  );
}
