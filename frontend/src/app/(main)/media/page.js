"use client";

// import { useState } from "react";
// import { mediaFiles } from '@/mock';
// import { MobileNav } from '@/components/layout';
// import { Button } from "@/components/ui/button";
// import { ScrollArea } from "@/components/ui/scroll-area";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import {
//     Dialog,
//     DialogContent,
//     DialogHeader,
//     DialogTitle,
// } from "@/components/ui/dialog";
// import {
//     ArrowLeft,
//     Image as ImageIcon,
//     FileText,
//     Film,
//     Music,
//     Download,
//     Share2,
//     Trash2,
//     X,
//     ChevronLeft,
//     ChevronRight,
//     MoreVertical,
// } from "lucide-react";
// import Link from "next/link";
// import {
//     DropdownMenu,
//     DropdownMenuContent,
//     DropdownMenuItem,
//     DropdownMenuTrigger,
// } from "@/components/ui/dropdown-menu";
// const typeIcons = {
//     image: ImageIcon,
//     video: Film,
//     document: FileText,
//     audio: Music,
// };
export default function MediaPage() {
    // const [selectedMedia, setSelectedMedia] = useState(null);
    // const [viewerOpen, setViewerOpen] = useState(false);
    // const images = mediaFiles.filter((m) => m.type === "image");
    // const videos = mediaFiles.filter((m) => m.type === "video");
    // const documents = mediaFiles.filter((m) => m.type === "document");
    // const openViewer = (media) => {
    //     setSelectedMedia(media);
    //     setViewerOpen(true);
    // };
    // const navigateMedia = (direction) => {
    //     if (!selectedMedia) return;
    //     const currentIndex = images.findIndex((m) => m.id === selectedMedia.id);
    //     if (currentIndex === -1) return;
    //     const newIndex =
    //         direction === "prev"
    //             ? (currentIndex - 1 + images.length) % images.length
    //             : (currentIndex + 1) % images.length;
    //     setSelectedMedia(images[newIndex]);
    // };
    return (
        <div>Media</div>
        // <div className="h-screen bg-background flex flex-col">
        //      <header className="p-4 border-b border-border bg-card/50 backdrop-blur-sm shrink-0">
        //          <div className="flex items-center justify-between">
        //              <div className="flex items-center gap-3">
        //                  <Link href="/chat" className="md:hidden">
        //                      <Button variant="ghost" size="icon">
        //                          <ArrowLeft className="h-5 w-5" />
        //                      </Button>
        //                  </Link>
        //                  <h1 className="text-xl font-bold">Media & Files</h1>
        //              </div>
        //          </div>
        //      </header>
        //      <Tabs
        //         defaultValue="images"
        //         className="flex-1 flex flex-col overflow-hidden"
        //     >
        //         <TabsList className="mx-4 mt-4 w-fit">
        //             <TabsTrigger value="images" className="gap-2">
        //                 <ImageIcon className="h-4 w-4" />
        //                 Images
        //             </TabsTrigger>
        //             <TabsTrigger value="videos" className="gap-2">
        //                 <Film className="h-4 w-4" />
        //                 Videos
        //             </TabsTrigger>
        //             <TabsTrigger value="files" className="gap-2">
        //                 <FileText className="h-4 w-4" />
        //                 Files
        //             </TabsTrigger>
        //         </TabsList>
        //         <TabsContent value="images" className="flex-1 overflow-hidden m-0">
        //             <ScrollArea className="h-full">
        //                 <div className="p-4">
        //                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        //                         {images.map((media) => (
        //                             <button
        //                                 key={media.id}
        //                                 onClick={() => openViewer(media)}
        //                                 className="aspect-square rounded-lg overflow-hidden bg-muted relative group"
        //                             >
        //                                 <img
        //                                     src={media.url}
        //                                     alt={media.name}
        //                                     className="w-full h-full object-cover transition-transform group-hover:scale-105"
        //                                 />
        //                                 <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
        //                             </button>
        //                         ))}
        //                     </div>
        //                     {images.length === 0 && (
        //                         <div className="flex flex-col items-center justify-center py-12 text-center">
        //                             <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        //                                 <ImageIcon className="h-8 w-8 text-muted-foreground" />
        //                             </div>
        //                             <p className="font-medium">No images</p>
        //                             <p className="text-sm text-muted-foreground mt-1">
        //                                 Shared images will appear here
        //                             </p>
        //                         </div>
        //                     )}
        //                 </div>
        //             </ScrollArea>
        //         </TabsContent>
        //         <TabsContent value="videos" className="flex-1 overflow-hidden m-0">
        //             <ScrollArea className="h-full">
        //                 <div className="p-4">
        //                     <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        //                         {videos.map((media) => (
        //                             <div
        //                                 key={media.id}
        //                                 className="rounded-lg overflow-hidden bg-muted relative group cursor-pointer"
        //                             >
        //                                 <div className="aspect-video bg-linear-to-br from-primary/20 to-accent/20 flex items-center justify-center">
        //                                     <Film className="h-10 w-10 text-primary/50" />
        //                                 </div>
        //                                 <div className="p-3">
        //                                     <p className="text-sm font-medium truncate">
        //                                         {media.name}
        //                                     </p>
        //                                     <p className="text-xs text-muted-foreground">
        //                                         {media.size}
        //                                     </p>
        //                                 </div>
        //                             </div>
        //                         ))}
        //                     </div>
        //                     {videos.length === 0 && (
        //                         <div className="flex flex-col items-center justify-center py-12 text-center">
        //                             <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        //                                 <Film className="h-8 w-8 text-muted-foreground" />
        //                             </div>
        //                             <p className="font-medium">No videos</p>
        //                             <p className="text-sm text-muted-foreground mt-1">
        //                                 Shared videos will appear here
        //                             </p>
        //                         </div>
        //                     )}
        //                 </div>
        //             </ScrollArea>
        //         </TabsContent>
        //         <TabsContent value="files" className="flex-1 overflow-hidden m-0">
        //             <ScrollArea className="h-full">
        //                 <div className="p-4 space-y-2">
        //                     {documents.map((media) => {
        //                         const Icon = typeIcons[media.type];
        //                         return (
        //                             <div
        //                                 key={media.id}
        //                                 className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors group"
        //                             >
        //                                 <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        //                                     <Icon className="h-6 w-6 text-primary" />
        //                                 </div>
        //                                 <div className="flex-1 min-w-0">
        //                                     <p className="font-medium truncate">{media.name}</p>
        //                                     <p className="text-sm text-muted-foreground">
        //                                         {media.size} • {media.uploadedAt}
        //                                     </p>
        //                                 </div>
        //                                 <div className="flex items-center gap-1">
        //                                     <Button variant="ghost" size="icon">
        //                                         <Download className="h-4 w-4" />
        //                                     </Button>
        //                                     <DropdownMenu>
        //                                         <DropdownMenuTrigger asChild={true}>
        //                                             <Button variant="ghost" size="icon">
        //                                                 <MoreVertical className="h-4 w-4" />
        //                                             </Button>
        //                                         </DropdownMenuTrigger>
        //                                         <DropdownMenuContent align="end">
        //                                             <DropdownMenuItem>
        //                                                 <Share2 className="h-4 w-4 mr-2" />
        //                                                 Share
        //                                             </DropdownMenuItem>
        //                                             <DropdownMenuItem className="text-destructive">
        //                                                 <Trash2 className="h-4 w-4 mr-2" />
        //                                                 Delete
        //                                             </DropdownMenuItem>
        //                                         </DropdownMenuContent>
        //                                     </DropdownMenu>
        //                                 </div>
        //                             </div>
        //                         );
        //                     })}
        //                     {documents.length === 0 && (
        //                         <div className="flex flex-col items-center justify-center py-12 text-center">
        //                             <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        //                                 <FileText className="h-8 w-8 text-muted-foreground" />
        //                             </div>
        //                             <p className="font-medium">No files</p>
        //                             <p className="text-sm text-muted-foreground mt-1">
        //                                 Shared files will appear here
        //                             </p>
        //                         </div>
        //                     )}
        //                 </div>
        //             </ScrollArea>
        //         </TabsContent>
        //     </Tabs>
        //     <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        //         <DialogContent className="max-w-4xl p-0 bg-black/95 border-none">
        //             <DialogHeader className="absolute top-0 left-0 right-0 p-4 z-10 bg-linear-to-b from-black/50 to-transparent">
        //                 <div className="flex items-center justify-between">
        //                     <DialogTitle className="text-white">
        //                         {selectedMedia?.name}
        //                     </DialogTitle>
        //                     <div className="flex items-center gap-2">
        //                         <Button
        //                             variant="ghost"
        //                             size="icon"
        //                             className="text-white hover:bg-white/20"
        //                         >
        //                             <Download className="h-5 w-5" />
        //                         </Button>
        //                         <Button
        //                             variant="ghost"
        //                             size="icon"
        //                             className="text-white hover:bg-white/20"
        //                         >
        //                             <Share2 className="h-5 w-5" />
        //                         </Button>
        //                         <Button
        //                             variant="ghost"
        //                             size="icon"
        //                             className="text-white hover:bg-white/20"
        //                             onClick={() => setViewerOpen(false)}
        //                         >
        //                             <X className="h-5 w-5" />
        //                         </Button>
        //                     </div>
        //                 </div>
        //             </DialogHeader>
        //             <div className="relative flex items-center justify-center min-h-[60vh]">
        //                 <Button
        //                     variant="ghost"
        //                     size="icon"
        //                     className="absolute left-4 text-white hover:bg-white/20 z-10"
        //                     onClick={() => navigateMedia("prev")}
        //                 >
        //                     <ChevronLeft className="h-8 w-8" />
        //                 </Button>
        //                 {selectedMedia && (
        //                     <img
        //                         src={selectedMedia.url}
        //                         alt={selectedMedia.name}
        //                         className="max-w-full max-h-[80vh] object-contain"
        //                     />
        //                 )}
        //                 <Button
        //                     variant="ghost"
        //                     size="icon"
        //                     className="absolute right-4 text-white hover:bg-white/20 z-10"
        //                     onClick={() => navigateMedia("next")}
        //                 >
        //                     <ChevronRight className="h-8 w-8" />
        //                 </Button>
        //             </div>
        //         </DialogContent>
        //     </Dialog>
        //     <div className="md:hidden">
        //         <MobileNav />
        //     </div>
        // </div>
    );
}
