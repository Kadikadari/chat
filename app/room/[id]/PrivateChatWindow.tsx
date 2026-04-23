// app/room/[id]/PrivateChatWindow.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "../../../lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  where,
  getDocs
} from "firebase/firestore";

interface Message {
  id: string;
  text: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  timestamp: any;
  isRead: boolean;
}

interface PrivateChatWindowProps {
  conversationId: string;
  currentUser: any;
  onClose: () => void;
}

export default function PrivateChatWindow({ conversationId, currentUser, onClose }: PrivateChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [otherUser, setOtherUser] = useState<{ id: string; name: string } | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [size, setSize] = useState({ width: 320, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // تحديث الرسائل كـ "مقروءة" عند فتح النافذة
  useEffect(() => {
    if (!conversationId || !currentUser) return;

    const markAsRead = async () => {
      const msgsRef = collection(db, "conversations", conversationId, "messages");
      const q = query(msgsRef, where("toUserId", "==", currentUser.uid), where("isRead", "==", false));
      const snapshot = await getDocs(q);
      snapshot.forEach((msgDoc) => {
        updateDoc(msgDoc.ref, { isRead: true });
      });
    };

    markAsRead();
  }, [conversationId, currentUser, messages.length]); // يتحدث عند وصول رسائل جديدة أيضاً

  useEffect(() => {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    return onSnapshot(userRef, (snap) => {
      if (snap.exists()) setIsMuted(snap.data().isGlobalMuted || false);
    });
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentUser || !conversationId) return;
    const fetchConversation = async () => {
      const convRef = doc(db, "conversations", conversationId);
      const convSnap = await getDoc(convRef);
      if (convSnap.exists()) {
        const otherId = convSnap.data().participants.find((id: string) => id !== currentUser.uid);
        if (otherId) {
          setOtherUser({ id: otherId, name: convSnap.data().participantsDetails?.[otherId]?.displayName || "مستخدم" });
        }
      }
    };
    fetchConversation();
  }, [currentUser, conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const q = query(collection(db, "conversations", conversationId, "messages"), orderBy("timestamp", "asc"));
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]);
    });
  }, [conversationId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !otherUser || isMuted) return;

    const msgText = newMessage.trim();
    setNewMessage("");

    try {
      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        text: msgText,
        fromUserId: currentUser.uid,
        fromUserName: currentUser.displayName || "أنا",
        toUserId: otherUser.id,
        timestamp: serverTimestamp(),
        isRead: false
      });

      const convRef = doc(db, "conversations", conversationId);
      await updateDoc(convRef, {
        lastMessageTime: serverTimestamp(),
        lastSenderId: currentUser.uid
      });
    } catch (error) {
      console.error("Error sending private message:", error);
    }
  };

  const startDragging = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.close-btn')) return;
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
      else if (isResizing) setSize({ width: Math.max(280, e.clientX - position.x), height: Math.max(300, e.clientY - position.y) });
    };
    const onMouseUp = () => { setIsDragging(false); setIsResizing(false); };
    if (isDragging || isResizing) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, position]);

  if (!otherUser) return null;

  return (
    <div style={{ ...styles.floatingWindow, left: position.x, top: position.y, width: size.width, height: size.height }}>
      <div style={styles.header} onMouseDown={startDragging}>
        <span>💬 {otherUser.name}</span>
        <button onClick={onClose} style={styles.closeBtn} className="close-btn">✕</button>
      </div>
      <div style={styles.messagesArea}>
        {messages.map((msg) => (
          <div key={msg.id} style={{
            ...styles.message,
            alignSelf: msg.fromUserId === currentUser.uid ? "flex-end" : "flex-start",
            backgroundColor: msg.fromUserId === currentUser.uid ? "#e94560" : "#fff",
            color: msg.fromUserId === currentUser.uid ? "#fff" : "#333",
          }}>
            {msg.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} style={styles.inputArea}>
        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={isMuted ? "أنت مكتوم" : "اكتب رسالة..."} style={styles.input} disabled={isMuted} />
        <button type="submit" style={styles.sendBtn} disabled={isMuted}>إرسال</button>
      </form>
      <div style={styles.resizeHandle} onMouseDown={startResizing} />
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  floatingWindow: { position: "fixed", backgroundColor: "#f5f5f5", borderRadius: "12px", boxShadow: "0 10px 40px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", zIndex: 3500, border: "1px solid #ddd", overflow: "hidden", direction: "rtl", minWidth: "280px", minHeight: "300px" },
  header: { padding: "10px 15px", backgroundColor: "#0f3460", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold", cursor: "move", userSelect: "none" },
  closeBtn: { background: "none", border: "none", color: "white", cursor: "pointer", fontSize: "1.2rem" },
  messagesArea: { flex: 1, overflowY: "auto", padding: "15px", display: "flex", flexDirection: "column", gap: "8px" },
  message: { padding: "8px 12px", borderRadius: "12px", maxWidth: "80%", fontSize: "0.9rem", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" },
  inputArea: { padding: "10px", display: "flex", gap: "8px", backgroundColor: "white", borderTop: "1px solid #eee" },
  input: { flex: 1, padding: "8px", borderRadius: "8px", border: "1px solid #ddd", outline: "none" },
  sendBtn: { backgroundColor: "#e94560", color: "white", border: "none", padding: "8px 15px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  resizeHandle: { position: "absolute", bottom: "0", right: "0", width: "15px", height: "15px", cursor: "nwse-resize", backgroundColor: "transparent", zIndex: 2001 }
};
