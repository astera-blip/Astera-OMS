import { PaymentOperationsBoard } from "@/components/workspace/PaymentOperationsBoard";
import { PaymentAccountsBoard } from "@/components/workspace/PaymentAccountsBoard";
import { MemberPaymentAccountRequestsBoard } from "@/components/workspace/MemberPaymentAccountRequestsBoard";
import { TaishinReconciliationBoard } from "@/components/workspace/TaishinReconciliationBoard";

export default function WorkspacePaymentsPage() {
  return (
    <div className="grid gap-6">
      <PaymentAccountsBoard />
      <MemberPaymentAccountRequestsBoard />
      <TaishinReconciliationBoard />
      <PaymentOperationsBoard />
    </div>
  );
}
