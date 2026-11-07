import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { AboutView } from "@/components/AboutView";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = { title: "About — SiteSentinel" };

export default function AboutPage() {
  return (
    <>
      <Header />
      <main className="container">
        <AboutView />
      </main>
      <Footer />
    </>
  );
}
