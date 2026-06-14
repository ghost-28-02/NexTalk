'use client'

import Link from 'next/link'
import { Logo } from '@/components/common'
import { Button } from '@/components/ui/button'
import { ArrowRight, MessageSquare, Video, Shield, Zap } from 'lucide-react'

const features = [
    {
        icon: MessageSquare,
        title: 'Real-time Chat',
        description: 'Instant messaging with typing indicators and read receipts',
    },
    {
        icon: Video,
        title: 'HD Video Calls',
        description: 'Crystal clear video and audio calls with screen sharing',
    },
    {
        icon: Shield,
        title: 'End-to-End Encryption',
        description: 'Your conversations are private and secure',
    },
    {
        icon: Zap,
        title: 'Lightning Fast',
        description: 'Built for speed with instant message delivery',
    },
]

export default function Home() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
            <div className="absolute inset-0 gradient-mesh opacity-50" />
            <div className="absolute top-1/4 -left-32 w-64 h-64 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full bg-accent/20 blur-3xl" />

            <div className="relative z-10 min-h-screen flex flex-col">
                <header className="p-6 flex items-center justify-between">
                    <Logo size="md" />
                    <Link href="/login">
                        <Button size="lg" variant="outline" className="gap-2 px-5">
                            Sign In
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </Link>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
                    <div className="max-w-3xl mx-auto text-center space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                            <Zap className="h-4 w-4" />
                            <span>The future of communication</span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-balance">
                            Connect Instantly with <span className="text-primary">NexTalk</span>
                        </h1>

                        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
                            Experience seamless communication with real-time messaging, crystal-clear video calls,
                            and enterprise-grade security.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <Link href="/signup">
                                <Button
                                    size="lg"
                                    className="gap-2 gradient-primary text-white border-0 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                                >
                                    Get Started Free
                                    <ArrowRight className="h-4 w-4" />
                                </Button>
                            </Link>

                            <Link href="/login">
                                <Button size="lg" variant="outline" className="gap-2 px-13">
                                    Sign In
                                </Button>
                            </Link>
                        </div>
                    </div>

                    <div className="mt-20 w-full max-w-4xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {features.map((feature) => (
                                <div
                                    key={feature.title}
                                    className="group p-6 rounded-2xl bg-card/50 border border-border hover:border-primary/50 hover:bg-card transition-all duration-300"
                                >
                                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                                        <feature.icon className="h-6 w-6 text-primary" />
                                    </div>
                                    <h3 className="font-semibold mb-2">{feature.title}</h3>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>

                <footer className="p-6 text-center text-sm text-muted-foreground">
                    <p>© 2024 NexTalk. All rights reserved.</p>
                </footer>
            </div>
        </div>
  );
}
