// app/private/[conversationId]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db, auth } from "../../../lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

interface Message {
  id: string;
  text: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  timestamp: any;
  isRead?: boolean;
}

interface WindowState {
  width: number;
  height: number;
  x: number;
  y: number;
  isMaximized: boolean;
}

export default function PrivateChat() {
  const { conversationId } = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowState, setWindowState] = useState<WindowState>({
    width: 320,
    height: 480,
    x: 0,
    y: 0,
    isMaximized: false,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0 });

  // تهيئة موضع النافذة
  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowState((prev) => ({
        ...prev,
        x: Math.max(0, window.innerWidth - 370),
        y: Math.max(0, window.innerHeight - 530),
      }));
    }
  }, []);

  // 1. التحقق من تسجيل الدخول
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/");
      } else {
        setCurrentUser(user);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // معالجات السحب والتحجيم
  const handleMouseDown = (e: React.MouseEvent, type: "drag" | "resize") => {
    e.preventDefault();
    if (type === "drag") {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - windowState.x,
        y: e.clientY - windowState.y,
      });
    } else if (type === "resize") {
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !windowState.isMaximized && typeof window !== "undefined") {
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - windowState.width));
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - windowState.height));
        setWindowState((prev) => ({
          ...prev,
          x: newX,
          y: newY,
        }));
      } else if (isResizing && !windowState.isMaximized) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        setWindowState((prev) => ({
          ...prev,
          width: Math.max(280, prev.width + deltaX),
          height: Math.max(350, prev.height + deltaY),
        }));
        setResizeStart({
          x: e.clientX,
          y: e.clientY,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, windowState.isMaximized, windowState.width, windowState.height]);

  const toggleMaximize = () => {
    setWindowState((prev) => ({
      ...prev,
      isMaximized: !prev.isMaximized,
      ...(prev.isMaximized && {
        width: 320,
        height: 480,
        x: Math.max(0, window.innerWidth - 370),
        y: Math.max(0, window.innerHeight - 530),
      }),
    }));
  };

  // 2. جلب معلومات الطرف الآخر من conversationId
  useEffect(() => {
    if (!currentUser || !conversationId) return;
    const fetchConversation = async () => {
      try {
        const convRef = doc(db, "conversations", conversationId as string);
        const convSnap = await getDoc(convRef);
        if (convSnap.exists()) {
          const participants = convSnap.data().participants;
          const otherId = participants.find((id: string) => id !== currentUser.uid);
          if (otherId) {
            const userName = convSnap.data().participantsDetails?.[otherId]?.displayName || "مستخدم";
            setOtherUser({ id: otherId, name: userName });
          } else {
            router.push("/rooms");
          }
        } else {
          router.push("/rooms");
        }
      } catch (error) {
        console.error(error);
        router.push("/rooms");
      } finally {
        setLoading(false);
      }
    };
    fetchConversation();
  }, [currentUser, conversationId, router]);

  // 3. الاستماع للرسائل وتحديث حالة القراءة
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    const messagesRef = collection(db, "conversations", conversationId as string, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];
      setMessages(msgs);

      // تعيين الرسائل الموجهة للمستخدم الحالي وغير المقروءة إلى مقروءة
      const unreadDocs = snapshot.docs.filter((doc) => {
        const data = doc.data();
        return data.toUserId === currentUser.uid && data.isRead === false;
      });
      for (const docRef of unreadDocs) {
        await updateDoc(docRef.ref, { isRead: true });
      }
    });
    return () => unsubscribe();
  }, [conversationId, currentUser]);

  // 4. إرسال رسالة خاصة مع isRead = false
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || !otherUser || !conversationId) return;
    
    try {
      // جلب اسم المستخدم الخاص (nickname) من Firestore
      let fromUserName = currentUser.email?.split("@")[0] || "مستخدم";
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          // استخدام nickname إن وجد، وإلا displayName
          fromUserName = userSnap.data().nickname || userSnap.data().displayName || fromUserName;
          console.log("💬 اسم المرسل في المحادثة الخاصة:", fromUserName);
        }
      } catch (error) {
        console.error("خطأ في جلب اسم المستخدم:", error);
      }

      const messagesRef = collection(db, "conversations", conversationId as string, "messages");
      await addDoc(messagesRef, {
        text: newMessage.trim(),
        fromUserId: currentUser.uid,
        fromUserName: fromUserName,
        toUserId: otherUser.id,
        timestamp: new Date(),
        isRead: false,
      });
      
      const convRef = doc(db, "conversations", conversationId as string);
      await setDoc(
        convRef,
        {
          lastMessage: newMessage.trim(),
          lastMessageTime: new Date(),
        },
        { merge: true }
      );
      
      setNewMessage("");
    } catch (error) {
      console.error("خطأ في إرسال الرسالة:", error);
    }
  };

  if (loading) return <div style={styles.loading}>جاري التحميل...</div>;
  if (!otherUser) return <div style={styles.loading}>لم يتم العثور على المحادثة</div>;

  const windowStyle: React.CSSProperties = windowState.isMaximized
    ? styles.windowMaximized
    : {
        ...styles.window,
        width: windowState.width,
        height: windowState.height,
        left: windowState.x,
        top: windowState.y,
      };

  return (
    <div
      style={windowStyle}
      className="floating-window"
    >
      {/* رأس النافذة */}
      <div
        style={styles.windowHeader}
        onMouseDown={(e) => handleMouseDown(e, "drag")}
      >
        <div style={styles.headerContent}>
          <h2 style={styles.headerTitle}>{otherUser.name}</h2>
          <div style={styles.headerButtons}>
            <button
              onClick={toggleMaximize}
              style={styles.headerButton}
              title={windowState.isMaximized ? "تصغير" : "تكبير"}
            >
              {windowState.isMaximized ? "🔽" : "🔼"}
            </button>
            <button
              onClick={() => router.back()}
              style={styles.headerButton}
              title="إغلاق"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* منطقة الرسائل */}
      <div style={styles.messagesArea}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              ...styles.message,
              alignSelf: msg.fromUserId === currentUser?.uid ? "flex-end" : "flex-start",
              backgroundColor: msg.fromUserId === currentUser?.uid ? "#dcf8c5" : "#ffffff",
            }}
          >
            <strong>{msg.fromUserName}:</strong> {msg.text}
            <span style={styles.time}>
              {msg.timestamp?.toDate?.().toLocaleTimeString() || ""}
            </span>
          </div>
        ))}
      </div>

      {/* نموذج الإدخال */}
      <form onSubmit={sendMessage} style={styles.inputForm}>
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="اكتب رسالة..."
          style={styles.input}
        />
        <button type="submit" style={styles.sendButton}>
          إرسال
        </button>
      </form>

      {/* مقبض تغيير الحجم */}
      {!windowState.isMaximized && (
        <div
          style={styles.resizeHandle}
          onMouseDown={(e) => handleMouseDown(e, "resize")}
          title="اسحب لتغيير حجم النافذة"
        />
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  loading: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    fontSize: "1.2rem",
    backgroundColor: "#f0f0f0",
  },
  window: {
    position: "fixed",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#e5ddd5",
    borderRadius: "10px",
    boxShadow: "0 5px 20px rgba(0, 0, 0, 0.3)",
    zIndex: 1000,
    fontFamily: "sans-serif",
    border: "1px solid #075e54",
    userSelect: "none",
  },
  windowMaximized: {
    position: "fixed",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#e5ddd5",
    borderRadius: "0",
    boxShadow: "0 5px 20px rgba(0, 0, 0, 0.3)",
    zIndex: 1000,
    fontFamily: "sans-serif",
    border: "none",
    width: "100vw",
    height: "100vh",
    left: 0,
    top: 0,
    userSelect: "none",
  },
  windowHeader: {
    padding: "0.6rem 0.8rem",
    backgroundColor: "#075e54",
    color: "white",
    borderRadius: "10px 10px 0 0",
    cursor: "move",
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerContent: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  headerTitle: {
    margin: 0,
    fontSize: "0.85rem",
    fontWeight: "bold",
  },
  headerButtons: {
    display: "flex",
    gap: "0.3rem",
    alignItems: "center",
  },
  headerButton: {
    backgroundColor: "#25d366",
    border: "none",
    padding: "0.2rem 0.4rem",
    borderRadius: "4px",
    cursor: "pointer",
    color: "white",
    fontSize: "0.8rem",
    transition: "background-color 0.2s",
  },
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    padding: "0.7rem 0.6rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.4rem",
  },
  message: {
    padding: "0.4rem 0.8rem",
    borderRadius: "8px",
    maxWidth: "85%",
    boxShadow: "0 1px 1px rgba(0,0,0,0.1)",
    wordWrap: "break-word",
    fontSize: "0.85rem",
    lineHeight: "1.3",
  },
  time: {
    fontSize: "0.65rem",
    color: "#888",
    marginLeft: "0.3rem",
    display: "block",
    marginTop: "0.1rem",
  },
  inputForm: {
    display: "flex",
    padding: "0.6rem",
    backgroundColor: "#f0f0f0",
    gap: "0.4rem",
    borderRadius: "0 0 10px 10px",
  },
  input: {
    flex: 1,
    padding: "0.5rem 0.8rem",
    borderRadius: "15px",
    border: "1px solid #ccc",
    fontSize: "0.8rem",
    outline: "none",
    transition: "border-color 0.2s",
  },
  sendButton: {
    backgroundColor: "#25d366",
    color: "white",
    border: "none",
    padding: "0.5rem 0.9rem",
    borderRadius: "15px",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: "bold",
    transition: "background-color 0.2s",
  },
  resizeHandle: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: "20px",
    height: "20px",
    cursor: "nwse-resize",
    backgroundColor: "transparent",
  },
};