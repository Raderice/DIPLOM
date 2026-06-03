import { Outlet } from "react-router-dom";
import Header from "./ui/Header";
import Footer from "./ui/Footer";

export default function Layout(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-[#0b0b0c] text-white">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
