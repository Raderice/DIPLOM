import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: "sans-serif", textAlign: "center" }}>
          <h2>Произошла ошибка</h2>
          <p>Попробуйте отключить расширения браузера или откройте сайт в режиме инкогнито.</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "8px 24px", cursor: "pointer" }}>
            Обновить страницу
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
