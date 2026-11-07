import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { HistoryView } from "@/components/HistoryView";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = { title: "Scan History — SiteSentinel" };

export default function HistoryPage() {
  return (
    <>
      <Header />
      <main className="container">
        <HistoryView />
      </main>
      <Footer />
    </>
  );
}
