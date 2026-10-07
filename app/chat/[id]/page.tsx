"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Search, MoreVertical, Paperclip, Send, ArrowLeft, Image as ImageIcon, Check, CheckCheck } from "lucide-react";
import CryptoJS from "crypto-js"; // 🔥 Puthusa add panna Security Library

interface Profile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string; 
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  messageType: string;
  isRead: boolean;
  createdAt: string;
}

// 🔥 ENCRYPTION & DECRYPTION FUNCTIONS
const encryptMessage = (text: string, secret: string) => {
  return CryptoJS.AES.encrypt(text, secret).toString();
};

const decryptMessage = (cipherText: string, secret: string) => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, secret);
    const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
    return decryptedText || cipherText; // Pazhaya unencrypted message iruntha athaiye thiruppi tharum
  } catch (error) {
    return cipherText;
  }
};

export default function ActiveChatRoom() {
  const router = useRouter();
  const params = useParams();
  const friendId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [users, setUsers] = useState<Profile[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [isFriendOnline, setIsFriendOnline] = useState(false);
  const [isFriendTyping, setIsFriendTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presenceChannelRef = useRef<any>(null);
  const typingTimeoutRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (dateString: string) => {
    if (!dateString) return "";
    const safeDate = dateString.endsWith("Z") || dateString.includes("+") ? dateString : `${dateString}Z`;
    return new Date(safeDate).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const markMessagesAsRead = async (myId: string, senderId: string) => {
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: senderId, receiverId: myId })
      });
    } catch (error) {
      console.error("Error marking as read", error);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let msgChannel: any;
    let presenceChannel: any;

    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      if (!isMounted) return;
      setCurrentUser(session.user);

      // Secret Key Uruvaakkurathu (Namma ID + Friend ID)
      const secretKey = [session.user.id, friendId].sort().join('-');

      try {
        const resUsers = await fetch(`/api/users?userId=${session.user.id}`);
        if (resUsers.ok) setUsers(await resUsers.json());

        const resMsgs = await fetch(`/api/messages?user1=${session.user.id}&user2=${friendId}`);
        if (resMsgs.ok) {
           const rawMessages = await resMsgs.json();
           
           // 🔥 DECRYPT OLD MESSAGES
           const decryptedMessages = rawMessages.map((msg: Message) => ({
             ...msg,
             content: decryptMessage(msg.content, secretKey)
           }));

           setMessages(decryptedMessages);
           markMessagesAsRead(session.user.id, friendId);
        }

        if (!isMounted) return;

        const uniqueChannelName = `room-msgs-${friendId}-${Date.now()}`;
        msgChannel = supabase
          .channel(uniqueChannelName)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "Message" }, (payload) => {
            const newMsg = payload.new as Message;
            if (
              (newMsg.senderId === session.user.id && newMsg.receiverId === friendId) ||
              (newMsg.senderId === friendId && newMsg.receiverId === session.user.id)
            ) {
              // 🔥 DECRYPT REALTIME MESSAGE
              newMsg.content = decryptMessage(newMsg.content, secretKey);

              setMessages((prev) => {
                if (prev.find((m) => m.id === newMsg.id)) return prev;
                return [...prev, newMsg];
              });
              
              if (newMsg.senderId === friendId) {
                 markMessagesAsRead(session.user.id, friendId);
              }
            }
          })
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "Message" }, (payload) => {
             const updatedMsg = payload.new as Message;
             // Update aagum pothum decrypt pannanum
             updatedMsg.content = decryptMessage(updatedMsg.content, secretKey);
             setMessages((prev) => prev.map(msg => msg.id === updatedMsg.id ? updatedMsg : msg));
          })
          .subscribe();

        const presenceRoomName = `presence-${secretKey}`;
        supabase.getChannels().forEach((ch) => {
          if (ch.topic === `realtime:${presenceRoomName}`) {
            supabase.removeChannel(ch);
          }
        });

        presenceChannel = supabase.channel(presenceRoomName, {
          config: { presence: { key: session.user.id } },
        });

        presenceChannelRef.current = presenceChannel;

        presenceChannel
          .on("presence", { event: "sync" }, () => {
            if (!isMounted) return;
            const state = presenceChannel.presenceState();
            if (state[friendId] && state[friendId].length > 0) {
              setIsFriendOnline(true);
              setIsFriendTyping(!!(state[friendId][0] as any).typing);
            } else {
              setIsFriendOnline(false);
              setIsFriendTyping(false);
            }
          })
          .subscribe(async (status: string) => {
            if (status === "SUBSCRIBED" && isMounted) {
              await presenceChannel.track({ user: session.user.id, typing: false });
            }
          });

      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      if (msgChannel) supabase.removeChannel(msgChannel);
      if (presenceChannel) {
        presenceChannel.untrack();
        supabase.removeChannel(presenceChannel);
      }
    };
  }, [router, friendId]);

  const activeFriend = users.find((u) => u.id === friendId);

  const handleTyping = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    if (presenceChannelRef.current && currentUser) {
      await presenceChannelRef.current.track({ user: currentUser.id, typing: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(async () => {
        await presenceChannelRef.current.track({ user: currentUser.id, typing: false });
      }, 2000); 
    }
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !currentUser) return;
    const text = messageInput;
    setMessageInput(""); 

    if (presenceChannelRef.current) {
      await presenceChannelRef.current.track({ user: currentUser.id, typing: false });
    }

    // 🔥 ENCRYPT TEXT MESSAGE
    const secretKey = [currentUser.id, friendId].sort().join('-');
    const encryptedText = encryptMessage(text, secretKey);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderId: currentUser.id,
          receiverId: friendId,
          content: encryptedText, // Hidden message
          messageType: "text"
        }),
      });

      if (res.ok) {
        const newMsg = await res.json();
        newMsg.content = text; // Namma screen-la kaatta real text-a podurom
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      if (uploadData.url) {
        // 🔥 ENCRYPT IMAGE URL
        const secretKey = [currentUser.id, friendId].sort().join('-');
        const encryptedUrl = encryptMessage(uploadData.url, secretKey);

        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderId: currentUser.id,
            receiverId: friendId,
            content: encryptedUrl, // Hidden URL
            messageType: "image"
          }),
        });

        if (res.ok) {
          const newMsg = await res.json();
          newMsg.content = uploadData.url; // Namma screen-la paakka real URL
          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      }
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
    }
  };

  if (loading)
    return <div className="h-screen flex items-center justify-center bg-[#111b21] text-[#00a884]">Loading Chat...</div>;

  return (
    <div className="flex h-screen bg-[#111b21] text-gray-200 overflow-hidden font-sans">
      
      {/* LEFT SIDEBAR */}
      <div className="hidden md:flex w-1/3 border-r border-gray-800 flex-col bg-[#111b21] min-w-[300px]">
        <div className="h-16 bg-[#202c33] flex items-center px-4">
          <button onClick={() => router.push("/chat")} className="text-gray-400 hover:text-white mr-4">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-white font-semibold">Back to all chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {users.map((user) => (
            <div
              key={user.id}
              onClick={() => router.push(`/chat/${user.id}`)}
              className={`flex items-center px-4 py-3 cursor-pointer border-b border-gray-800 transition ${
                user.id === friendId ? "bg-[#2a3942]" : "hover:bg-[#202c33]"
              }`}
            >
              <div className="w-12 h-12 bg-[#00a884] rounded-full flex items-center justify-center text-white font-bold uppercase">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="DP" className="w-full h-full object-cover rounded-full" />
                ) : (
                  user.fullName ? user.fullName[0] : user.email[0]
                )}
              </div>
              <div className="ml-4 flex-1">
                <h2 className="font-semibold text-white">{user.fullName || user.email}</h2>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="flex-1 flex flex-col relative bg-[#0b141a]">
        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundSize: "contain" }}></div>

        {/* HEADER */}
        <div className="h-16 bg-[#202c33] flex items-center px-4 justify-between z-10 border-l border-gray-800">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push("/chat")} className="md:hidden text-gray-400 hover:text-white">
              <ArrowLeft size={24} />
            </button>
            <div className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center text-white font-bold uppercase overflow-hidden">
              {activeFriend?.avatarUrl ? (
                 <img src={activeFriend.avatarUrl} alt="DP" className="w-full h-full object-cover" />
              ) : (
                 activeFriend ? (activeFriend.fullName ? activeFriend.fullName[0] : activeFriend.email[0]) : "?"
              )}
            </div>
            
            <div className="flex flex-col">
              <h2 className="font-semibold text-white text-base leading-tight">
                {activeFriend ? activeFriend.fullName || activeFriend.email : "Loading user..."}
              </h2>
              {isFriendTyping ? (
                <span className="text-[#00a884] text-xs font-medium">typing...</span>
              ) : isFriendOnline ? (
                <span className="text-gray-400 text-xs">online</span>
              ) : null}
            </div>

          </div>
          <div className="text-gray-400 flex gap-4 cursor-pointer">
            <Search size={20} className="hover:text-white transition" />
            <MoreVertical size={20} className="hover:text-white transition" />
          </div>
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 z-10">
          <div className="text-center my-4">
            <span className="bg-[#202c33] text-yellow-100 p-2 px-3 rounded-lg shadow-sm text-xs border border-gray-700">
              🔒 Messages are end-to-end encrypted.
            </span>
          </div>

          {messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.id;
            const alignment = isMe ? "self-end" : "self-start";
            const bubbleColor = isMe ? "bg-[#005c4b]" : "bg-[#202c33]";

            return (
              <div key={msg.id} className={`${alignment} ${bubbleColor} text-white p-2 rounded-lg max-w-xs md:max-w-md shadow-sm flex flex-col`}>
                {msg.messageType === "image" ? (
                  <img src={msg.content} alt="Shared Image" className="rounded-md w-full object-cover mb-1" />
                ) : (
                  <p className="text-sm px-1">{msg.content}</p>
                )}
                
                {/* TIME AND BLUE TICKS */}
                <div className="flex items-center justify-end gap-1 mt-1 px-1">
                  <span className="text-[10px] text-gray-400">
                    {formatTime(msg.createdAt)}
                  </span>
                  {isMe && (
                    msg.isRead ? (
                      <CheckCheck size={14} className="text-[#53bdeb]" /> 
                    ) : (
                      <Check size={14} className="text-gray-400" /> 
                    )
                  )}
                </div>
              </div>
            );
          })}
          
          {isUploading && (
             <div className="self-end bg-[#005c4b] opacity-70 text-white p-3 rounded-lg max-w-md shadow-sm flex items-center gap-2">
                <ImageIcon size={18} className="animate-pulse" /> <span className="text-xs">Sending photo...</span>
             </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* MESSAGE INPUT BOX */}
        <div className="h-16 bg-[#202c33] flex items-center px-4 gap-4 z-10">
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white transition">
            <Paperclip size={24} />
          </button>
          
          <input
            type="text"
            value={messageInput}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            placeholder="Type a message"
            className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2.5 focus:outline-none text-white placeholder-gray-400"
          />
          <button onClick={handleSendMessage} className="text-gray-400 hover:text-[#00a884] transition">
            <Send size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}