import { Header } from "@/components/Header";
import { Scanner } from "@/components/Scanner";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="container">
        <Scanner />
      </main>
      <Footer />
    </>
  );
}
