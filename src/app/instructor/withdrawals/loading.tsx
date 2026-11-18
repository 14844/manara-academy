import { WalletSkeleton } from "@/components/skeletons";

export default function InstructorWithdrawalsLoading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <WalletSkeleton />
    </div>
  );
}
