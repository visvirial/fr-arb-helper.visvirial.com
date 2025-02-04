import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'Funding Rate Arbitrage Helper',
	description: 'Show funding rates of different exchanges.',
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased`}
			>
				<AppRouterCacheProvider>
					<Container maxWidth="xl">
						{children}
						<hr
							style={{
								marginTop: '3em',
								marginBottom: '1em',
							}}
						/>
						<footer
							style={{
								marginBottom: '2em',
							}}
						>
							<p>
								Copyright &copy; <Link href="https://x.com/visvirial" target="_blank">@visvirial</Link>. All rights reserved.
							</p>
						</footer>
					</Container>
				</AppRouterCacheProvider>
			</body>
		</html>
	);
}
