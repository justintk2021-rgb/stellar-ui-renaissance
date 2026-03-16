import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Hash, Send, Image as ImageIcon, Smile, MessageSquare, Users, X, Loader2, Reply
} from "lucide-react";

interface Channel {
  id: string;
  name: string;
  description: string;
  is_default: boolean;
}

interface Message {
  id: string;
  channel_id: string | null;
  user_id: string;
  content: string;
  image_url: string | null;
  parent_id: string | null;
  created_at: string;
  profile?: { first_name: string | null; last_name: string | null; avatar_url: string | null };
  reactions?: Reaction[];
}

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface DMContact {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  last_message?: string;
  unread_count?: number;
}

interface DirectMessage {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
  profile?: { first_name: string | null; last_name: string | null; avatar_url: string | null };
}

const EMOJI_LIST = ["👍", "❤️", "🔥", "📈", "📉", "💯", "🎯", "🤔", "😂", "🚀"];

export function CommunityView() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [view, setView] = useState<"channels" | "dms">("channels");
  const [dmContacts, setDmContacts] = useState<DMContact[]>([]);
  const [selectedDmContact, setSelectedDmContact] = useState<DMContact | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [allProfiles, setAllProfiles] = useState<DMContact[]>([]);
  const [showNewDm, setShowNewDm] = useState(false);
  const [dmSearch, setDmSearch] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  // Fetch channels
  useEffect(() => {
    const fetchChannels = async () => {
      const { data } = await supabase
        .from("community_channels")
        .select("*")
        .order("is_default", { ascending: false });
      if (data) {
        setChannels(data);
        const defaultChannel = data.find((c: Channel) => c.is_default) || data[0];
        if (defaultChannel) setSelectedChannel(defaultChannel);
      }
      setIsLoading(false);
    };
    fetchChannels();
  }, []);

  // Fetch messages for selected channel
  useEffect(() => {
    if (!selectedChannel) return;

    const fetchMessages = async () => {
      const { data: msgs } = await supabase
        .from("community_messages")
        .select("*")
        .eq("channel_id", selectedChannel.id)
        .order("created_at", { ascending: true })
        .limit(200);

      if (msgs) {
        // Fetch profiles and reactions for messages
        const userIds = [...new Set(msgs.map((m: any) => m.user_id))];
        const msgIds = msgs.map((m: any) => m.id);

        const [{ data: profiles }, { data: reactions }] = await Promise.all([
          supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").in("user_id", userIds),
          supabase.from("community_reactions").select("*").in("message_id", msgIds),
        ]);

        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        const reactionMap = new Map<string, Reaction[]>();
        (reactions || []).forEach((r: any) => {
          const existing = reactionMap.get(r.message_id) || [];
          existing.push(r);
          reactionMap.set(r.message_id, existing);
        });

        setMessages(
          msgs.map((m: any) => ({
            ...m,
            profile: profileMap.get(m.user_id),
            reactions: reactionMap.get(m.id) || [],
          }))
        );
        setTimeout(scrollToBottom, 100);
      }
    };

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`community-${selectedChannel.id}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_messages", filter: `channel_id=eq.${selectedChannel.id}` }, async (payload) => {
        if (payload.eventType === "INSERT") {
          const newMsg = payload.new as any;
          const { data: profile } = await supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").eq("user_id", newMsg.user_id).single();
          setMessages((prev) => [...prev, { ...newMsg, profile, reactions: [] }]);
          setTimeout(scrollToBottom, 100);
        } else if (payload.eventType === "DELETE") {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id));
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "community_reactions" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const r = payload.new as Reaction;
          setMessages((prev) => prev.map((m) => m.id === r.message_id ? { ...m, reactions: [...(m.reactions || []), r] } : m));
        } else if (payload.eventType === "DELETE") {
          const r = payload.old as any;
          setMessages((prev) => prev.map((m) => m.id === r.message_id ? { ...m, reactions: (m.reactions || []).filter((x) => x.id !== r.id) } : m));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChannel, scrollToBottom]);

  // Fetch DM contacts
  useEffect(() => {
    if (!currentUserId) return;

    const fetchDmContacts = async () => {
      const { data: dms } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order("created_at", { ascending: false });

      if (dms && dms.length > 0) {
        const contactIds = [...new Set(dms.map((dm: any) => dm.sender_id === currentUserId ? dm.receiver_id : dm.sender_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").in("user_id", contactIds);

        const contacts: DMContact[] = (profiles || []).map((p: any) => ({
          ...p,
          last_message: dms.find((dm: any) => dm.sender_id === p.user_id || dm.receiver_id === p.user_id)?.content,
          unread_count: dms.filter((dm: any) => dm.sender_id === p.user_id && !dm.is_read).length,
        }));
        setDmContacts(contacts);
      }
    };

    fetchDmContacts();
  }, [currentUserId, view]);

  // Fetch DMs for selected contact
  useEffect(() => {
    if (!selectedDmContact || !currentUserId) return;

    const fetchDms = async () => {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${selectedDmContact.user_id}),and(sender_id.eq.${selectedDmContact.user_id},receiver_id.eq.${currentUserId})`)
        .order("created_at", { ascending: true })
        .limit(200);

      if (data) {
        const userIds = [...new Set(data.map((d: any) => d.sender_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").in("user_id", userIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setDirectMessages(data.map((d: any) => ({ ...d, profile: profileMap.get(d.sender_id) })));
        setTimeout(scrollToBottom, 100);

        // Mark as read
        await supabase.from("direct_messages").update({ is_read: true }).eq("sender_id", selectedDmContact.user_id).eq("receiver_id", currentUserId).eq("is_read", false);
      }
    };

    fetchDms();

    const channel = supabase
      .channel(`dm-${currentUserId}-${selectedDmContact.user_id}-${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, async (payload) => {
        const newDm = payload.new as any;
        if ((newDm.sender_id === currentUserId && newDm.receiver_id === selectedDmContact.user_id) ||
            (newDm.sender_id === selectedDmContact.user_id && newDm.receiver_id === currentUserId)) {
          const { data: profile } = await supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").eq("user_id", newDm.sender_id).single();
          setDirectMessages((prev) => [...prev, { ...newDm, profile }]);
          setTimeout(scrollToBottom, 100);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDmContact, currentUserId, scrollToBottom]);

  // Fetch all profiles for new DM
  useEffect(() => {
    if (!showNewDm || !currentUserId) return;
    const fetchProfiles = async () => {
      const { data } = await supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").neq("user_id", currentUserId);
      if (data) setAllProfiles(data);
    };
    fetchProfiles();
  }, [showNewDm, currentUserId]);

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    return `${(firstName || "?")[0]}${(lastName || "")[0] || ""}`.toUpperCase();
  };

  const getDisplayName = (firstName?: string | null, lastName?: string | null) => {
    const name = [firstName, lastName].filter(Boolean).join(" ");
    return name || "Anonymous";
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !pendingImage) || !currentUserId) return;
    setIsSending(true);

    try {
      if (view === "channels" && selectedChannel) {
        await supabase.from("community_messages").insert({
          channel_id: selectedChannel.id,
          user_id: currentUserId,
          content: newMessage.trim(),
          image_url: pendingImage,
        });
      } else if (view === "dms" && selectedDmContact) {
        await supabase.from("direct_messages").insert({
          sender_id: currentUserId,
          receiver_id: selectedDmContact.user_id,
          content: newMessage.trim(),
          image_url: pendingImage,
        });
      }
      setNewMessage("");
      setPendingImage(null);
    } catch {
      toast.error("Failed to send message");
    }
    setIsSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setUploadingImage(true);
    const fileName = `${currentUserId}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from("chat-images").upload(fileName, file);

    if (error) {
      toast.error("Failed to upload image");
    } else {
      const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(data.path);
      setPendingImage(urlData.publicUrl);
    }
    setUploadingImage(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!currentUserId) return;

    const existingReaction = messages
      .find((m) => m.id === messageId)
      ?.reactions?.find((r) => r.user_id === currentUserId && r.emoji === emoji);

    if (existingReaction) {
      await supabase.from("community_reactions").delete().eq("id", existingReaction.id);
    } else {
      await supabase.from("community_reactions").insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
    setShowEmojiPicker(null);
  };

  const startDmWithUser = (contact: DMContact) => {
    setSelectedDmContact(contact);
    setShowNewDm(false);
    setShowMobileSidebar(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessageBubble = (msg: Message | DirectMessage, isOwn: boolean) => {
    const profile = msg.profile;
    const reactions = "reactions" in msg ? msg.reactions || [] : [];
    const reactionGroups = new Map<string, string[]>();
    reactions.forEach((r) => {
      const users = reactionGroups.get(r.emoji) || [];
      users.push(r.user_id);
      reactionGroups.set(r.emoji, users);
    });

    return (
      <div key={msg.id} className={cn("flex gap-3 group px-2 py-1 hover:bg-muted/30 rounded-lg transition-colors", isOwn && "flex-row-reverse")}>
        <Avatar className="h-8 w-8 shrink-0 mt-0.5">
          <AvatarFallback className="text-xs bg-primary/20 text-primary">
            {getInitials(profile?.first_name, profile?.last_name)}
          </AvatarFallback>
        </Avatar>
        <div className={cn("flex flex-col max-w-[75%]", isOwn && "items-end")}>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-foreground">
              {getDisplayName(profile?.first_name, profile?.last_name)}
            </span>
            <span className="text-[10px] text-muted-foreground">{formatTime(msg.created_at)}</span>
          </div>
          <div className={cn(
            "rounded-2xl px-3.5 py-2 text-sm",
            isOwn ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted/60 text-foreground rounded-tl-sm"
          )}>
            {msg.content && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}
            {msg.image_url && (
              <img src={msg.image_url} alt="Shared" className="max-w-[280px] rounded-lg mt-1 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.image_url!, "_blank")} />
            )}
          </div>
          {/* Reactions */}
          {"reactions" in msg && reactionGroups.size > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Array.from(reactionGroups.entries()).map(([emoji, users]) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(msg.id, emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                    users.includes(currentUserId || "") ? "bg-primary/20 border-primary/40" : "bg-muted/40 border-border/50 hover:bg-muted/60"
                  )}
                >
                  <span>{emoji}</span>
                  <span className="text-[10px] text-muted-foreground">{users.length}</span>
                </button>
              ))}
            </div>
          )}
          {/* Reaction button */}
          {"reactions" in msg && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)}
                className="opacity-0 group-hover:opacity-100 mt-0.5 text-muted-foreground hover:text-foreground transition-all"
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              {showEmojiPicker === msg.id && (
                <div className="absolute bottom-6 left-0 z-50 bg-card border border-border rounded-xl shadow-lg p-2 flex gap-1 flex-wrap w-[220px]">
                  {EMOJI_LIST.map((emoji) => (
                    <button key={emoji} onClick={() => handleReaction(msg.id, emoji)} className="text-lg hover:scale-125 transition-transform p-0.5">
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const filteredProfiles = allProfiles.filter((p) => {
    const name = getDisplayName(p.first_name, p.last_name).toLowerCase();
    return name.includes(dmSearch.toLowerCase());
  });

  return (
    <div className="flex h-[calc(100vh-220px)] lg:h-[calc(100vh-180px)] rounded-xl overflow-hidden border border-border/50">
      {/* Sidebar */}
      <div className={cn(
        "w-full lg:w-64 shrink-0 border-r border-border/50 bg-card/50 flex flex-col",
        !showMobileSidebar && "hidden lg:flex"
      )}>
        {/* View toggle */}
        <div className="flex border-b border-border/50">
          <button
            onClick={() => setView("channels")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors",
              view === "channels" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Hash className="w-4 h-4" /> Channels
          </button>
          <button
            onClick={() => setView("dms")}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-colors relative",
              view === "dms" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MessageSquare className="w-4 h-4" /> DMs
            {dmContacts.some((c) => (c.unread_count || 0) > 0) && (
              <span className="absolute top-2 right-4 w-2 h-2 rounded-full bg-primary" />
            )}
          </button>
        </div>

        <ScrollArea className="flex-1">
          {view === "channels" ? (
            <div className="p-2 space-y-0.5">
              {channels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => { setSelectedChannel(channel); setShowMobileSidebar(false); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                    selectedChannel?.id === channel.id
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <Hash className="w-4 h-4 shrink-0" />
                  <span className="truncate">{channel.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-2 space-y-0.5">
              <button
                onClick={() => setShowNewDm(true)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors mb-2"
              >
                <Users className="w-4 h-4" />
                <span>New Message</span>
              </button>
              {dmContacts.map((contact) => (
                <button
                  key={contact.user_id}
                  onClick={() => { startDmWithUser(contact); }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors",
                    selectedDmContact?.user_id === contact.user_id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      {getInitials(contact.first_name, contact.last_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="truncate font-medium text-foreground">{getDisplayName(contact.first_name, contact.last_name)}</p>
                    {contact.last_message && (
                      <p className="truncate text-[11px] text-muted-foreground">{contact.last_message}</p>
                    )}
                  </div>
                  {(contact.unread_count || 0) > 0 && (
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                      {contact.unread_count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className={cn(
        "flex-1 flex flex-col bg-background/50",
        showMobileSidebar && "hidden lg:flex"
      )}>
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/30">
          <button onClick={() => setShowMobileSidebar(true)} className="lg:hidden text-muted-foreground hover:text-foreground">
            <Reply className="w-5 h-5 rotate-180" />
          </button>
          {view === "channels" && selectedChannel && (
            <>
              <Hash className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold text-sm">{selectedChannel.name}</h3>
                <p className="text-[11px] text-muted-foreground">{selectedChannel.description}</p>
              </div>
            </>
          )}
          {view === "dms" && selectedDmContact && (
            <>
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/20 text-primary">
                  {getInitials(selectedDmContact.first_name, selectedDmContact.last_name)}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-sm">{getDisplayName(selectedDmContact.first_name, selectedDmContact.last_name)}</h3>
            </>
          )}
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-3">
          <div className="space-y-1">
            {view === "channels"
              ? messages.map((msg) => renderMessageBubble(msg, msg.user_id === currentUserId))
              : directMessages.map((dm) => renderMessageBubble(dm as any, dm.sender_id === currentUserId))}
            <div ref={messagesEndRef} />
          </div>
          {((view === "channels" && messages.length === 0) || (view === "dms" && directMessages.length === 0)) && (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          )}
        </ScrollArea>

        {/* Pending image preview */}
        {pendingImage && (
          <div className="px-4 py-2 border-t border-border/30">
            <div className="relative inline-block">
              <img src={pendingImage} alt="Upload" className="h-20 rounded-lg" />
              <button onClick={() => setPendingImage(null)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input area */}
        <div className="px-3 py-3 border-t border-border/50 bg-card/30">
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
            <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => fileInputRef.current?.click()} disabled={uploadingImage}>
              {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
              placeholder={view === "channels" ? `Message #${selectedChannel?.name || ""}` : `Message ${getDisplayName(selectedDmContact?.first_name, selectedDmContact?.last_name)}`}
              className="flex-1 h-9 bg-muted/30 border-border/50"
              showNumberControls={false}
            />
            <Button size="icon" className="shrink-0 h-9 w-9" onClick={handleSendMessage} disabled={isSending || (!newMessage.trim() && !pendingImage)}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* New DM dialog */}
      {showNewDm && (
        <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowNewDm(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">New Message</h3>
              <button onClick={() => setShowNewDm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <Input
              value={dmSearch}
              onChange={(e) => setDmSearch(e.target.value)}
              placeholder="Search users..."
              className="mb-3"
              showNumberControls={false}
            />
            <ScrollArea className="h-60">
              <div className="space-y-1">
                {filteredProfiles.map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => startDmWithUser(p)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs bg-primary/20 text-primary">
                        {getInitials(p.first_name, p.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{getDisplayName(p.first_name, p.last_name)}</span>
                  </button>
                ))}
                {filteredProfiles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No users found</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}
    </div>
  );
}
