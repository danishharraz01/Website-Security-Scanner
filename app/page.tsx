import { Header } from "@/components/Header";
import { Scanner } from "@/components/Scanner";
import { Footer } from "@/components/Footer";

/** `?id=` opens a scan saved in this browser's history (see components/HistoryView.tsx). */
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await searchParams;
  const viewId = typeof id === "string" && id.length > 0 && id.length <= 64 ? id : null;

  return (
    <>
      <Header />
      <main className="container">
        <Scanner viewId={viewId} />
      </main>
      <Footer />
    </>
  );
}
