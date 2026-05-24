"use client";

import { useState } from "react";
import { users } from '@/mock';
import { UserAvatar } from '@/components/common';
import { MobileNav } from '@/components/layout';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowLeft,
    Search,
    UserPlus,
    MessageSquare,
    Phone,
    Video,
    MoreVertical,
    Users,
    QrCode,
} from "lucide-react";
import Link from "next/link";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
export default function ContactsPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const filteredUsers = users.filter(
        (user) =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase()),
    );
    // Group contacts by first letter
    const groupedContacts = filteredUsers.reduce((acc, user) => {
        const letter = user.name[0].toUpperCase();
        if (!acc[letter]) {
            acc[letter] = [];
        }
        acc[letter].push(user);
        return acc;
    }, {});
    const sortedLetters = Object.keys(groupedContacts).sort();
    return (
        <div className="h-screen bg-background flex flex-col">
            <header className="p-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <Link href="/chat" className="md:hidden">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h1 className="text-xl font-bold">Contacts</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                            <QrCode className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon">
                            <UserPlus className="h-5 w-5" />
                        </Button>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search contacts..."
                        className="pl-10 bg-muted/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </header>
            <Tabs defaultValue="all" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-4 mt-4 w-fit">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="online">Online</TabsTrigger>
                    <TabsTrigger value="favorites">Favorites</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="flex-1 overflow-hidden m-0">
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-6">
                            <Link
                                href="/chat"
                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                            >
                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Users className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <p className="font-medium">New Group</p>
                                    <p className="text-sm text-muted-foreground">
                                        Create a group chat
                                    </p>
                                </div>
                            </Link>
                            {sortedLetters.map((letter) => (
                                <div key={letter}>
                                    <div className="sticky top-0 bg-background py-2">
                                        <span className="text-xs font-semibold text-primary uppercase">
                                            {letter}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        {groupedContacts[letter].map((user) => (
                                            <div
                                                key={user.id}
                                                className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                                            >
                                                <UserAvatar user={user} size="lg" />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium truncate">{user.name}</p>
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {user.bio || user.email}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Link href={`/chat`}>
                                                        <Button variant="ghost" size="icon">
                                                            <MessageSquare className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/call/audio`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Phone className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Link href={`/call/video`}>
                                                        <Button variant="ghost" size="icon">
                                                            <Video className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild={true}>
                                                            <Button variant="ghost" size="icon">
                                                                <MoreVertical className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                                                            <DropdownMenuItem>
                                                                Add to Favorites
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem>Block Contact</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive">
                                                                Delete Contact
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                                    <p className="text-muted-foreground">No contacts found</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="online" className="flex-1 overflow-hidden m-0">
                    <ScrollArea className="h-full">
                        <div className="p-4 space-y-1">
                            {filteredUsers
                                .filter((u) => u.status === "online")
                                .map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
                                    >
                                        <UserAvatar user={user} size="lg" />
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium truncate">{user.name}</p>
                                            <p className="text-sm text-muted-foreground truncate">
                                                {user.bio}
                                            </p>
                                        </div>
                                        <Link href="/chat">
                                            <Button variant="ghost" size="icon">
                                                <MessageSquare className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </div>
                                ))}
                        </div>
                    </ScrollArea>
                </TabsContent>
                <TabsContent value="favorites" className="flex-1 overflow-hidden m-0">
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                            <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <p className="font-medium">No favorites yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Add contacts to your favorites for quick access
                        </p>
                    </div>
                </TabsContent>
            </Tabs>
            <div className="md:hidden">
                <MobileNav activePage="contacts" />
            </div>
        </div>
    );
}
