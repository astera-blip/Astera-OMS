import Link from "next/link";
import { MemberPaymentAccountsBoard } from "@/components/account/MemberPaymentAccountsBoard";

export default function MemberBankAccountsPage() {
  return (
    <main className="min-h-dvh bg-[#F7F3F2] px-5 py-8 text-[#20242B] sm:py-12">
      <section className="mx-auto max-w-3xl">
        <header className="mb-6 border-b border-[#DED7D6] pb-6">
          <p className="text-sm font-semibold text-[#466060]">會員付款設定</p>
          <h1 className="mt-2 font-serif text-3xl">我的匯款帳戶</h1>
          <p className="mt-2 text-sm leading-6 text-[#6C6B70]">
            可保存最多 5 筆自己的銀行帳戶。完整帳號只用來建立安全識別，之後只保留銀行代碼、末五碼與不可逆帳號識別碼。
          </p>
          <Link href="/members" className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-[#DED7D6] px-4 text-sm font-semibold text-[#20242B] hover:border-[#6E4E64] hover:bg-[#E7DDDF]">
            回到會員工作台
          </Link>
        </header>
        <MemberPaymentAccountsBoard />
      </section>
    </main>
  );
}
