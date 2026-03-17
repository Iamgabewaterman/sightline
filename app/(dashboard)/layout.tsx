import BottomTabBar from "@/components/BottomTabBar";
import { ClockProvider } from "@/components/ClockContext";
import ClockWidget from "@/components/ClockWidget";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClockProvider>
      {/* Extra bottom padding so content clears the fixed tab bar + optional banner */}
      <div className="pb-[calc(56px+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <ClockWidget />
      <BottomTabBar />
    </ClockProvider>
  );
}
