import { Outlet } from "react-router-dom";
import Header from "./ui/Header";
import Footer from "./ui/Footer";

export default function Layout(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <Header />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
