import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CropSaathiChat from './CropSaathiChat';

class ChatbotErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('CropSaathi chatbot failed to render.', error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

const Layout = () => {
  const { pathname } = useLocation();
  return (
    <div className="site-shell flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow">
        <Outlet />
      </main>
      <Footer />
      <ChatbotErrorBoundary key={pathname}><CropSaathiChat /></ChatbotErrorBoundary>
    </div>
  );
};

export default Layout;
