import { Inter, Geist_Mono } from 'next/font/google';
import { AppProviders } from '@/providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
    title: 'NexTalk - Modern Communication Platform',
    description: 'Connect, chat, and collaborate with NexTalk - the next generation communication platform',
    author: 'Sachin Choudhary',
    icons: {
        icon: [
            { url: '/favicon.svg', type: 'image/svg+xml' },
            { url: '/icon-32x32.png', sizes: '32x32', type: 'image/png' },
            { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        ],
        apple: '/apple-icon.png',
    },
};

export const viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#f8f7fc' },
        { media: '(prefers-color-scheme: dark)', color: '#1a1625' },
    ],
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased bg-background`}>
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
