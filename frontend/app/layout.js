'use client';
import { SessionProvider } from "next-auth/react";
import Sidebar from "./components/Sidebar";

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                <SessionProvider>
                    <div style={{ display: 'flex', height: '100vh' }}>
                        <Sidebar />
                        <main className="main" style={{ flex: 1, overflowY: 'auto' }}>
                            {children}
                        </main>
                    </div>
                </SessionProvider>
            </body>
        </html>
    );
}