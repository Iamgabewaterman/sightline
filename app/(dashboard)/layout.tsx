import BottomTabBar from "@/components/BottomTabBar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Extra bottom padding so content clears the fixed tab bar */}
      <div className="pb-[calc(56px+env(safe-area-inset-bottom))]">
        {children}
      </div>
      <BottomTabBar />
    </>
  );
}
