// app/room/[id]/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
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
  updateDoc,
  arrayUnion,
  arrayRemove,
  where,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import PrivateChatWindow from "./PrivateChatWindow";

const ADMIN_UIDS = [
  "DySgWK8YlHbgQqSgbtL3eznw7lh2",
  "fhHNmiIGCHMLCQtzneMaqKMutdW2",
  "YCl67FH3hjfH7bcOnBNn0JI67273",
  "9AHfCSHqu0MzOKoCEL7DS1hAcox2"
];

export default function ChatRoom() {
  const { id: roomId } = useParams();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [usersInRoom, setUsersInRoom] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomData, setRoomData] = useState<any>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState<any>({ visible: false, x: 0, y: 0, userId: "", userName: "", role: "" });
  const [activePrivateChat, setActivePrivateChat] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const entryTimeRef = useRef<number>(Date.now());
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu((prev: any) => ({ ...prev, visible: false }));
      }
    };
    if (showContextMenu.visible) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showContextMenu.visible]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
      } else {
        setCurrentUser(user);
        const superStatus = ADMIN_UIDS.includes(user.uid);
        setIsSuperAdmin(superStatus);

        const roomRef = doc(db, "rooms", roomId as string);
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.exists()) {
          const data = roomSnap.data();
          setRoomData(data);
          setRoomName(data.name);
          if (data.bannedUsers?.includes(user.uid)) {
            alert("أنت محظور من الغرفة.");
            router.push("/rooms");
            return;
          }
          setIsModerator(data.moderators?.includes(user.uid));
        }

        const userDocRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const uName = userSnap.data().nickname || "مستخدم";
          setCurrentUserName(superStatus ? "المدير 👑" : uName);
        } else {
          setCurrentUserName(superStatus ? "المدير 👑" : "مستخدم");
        }

        onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const userData = snap.data();
            if (userData.kickedFrom === roomId) {
              alert("تم طردك من الغرفة.");
              router.push("/rooms");
            }
            setIsMuted(userData.isGlobalMuted || false);
          }
        });
      }
    });
    return () => unsubscribe();
  }, [roomId, router]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const data = change.doc.data();
          const lastMsgTime = data.lastMessageTime?.toMillis() || 0;
          if (lastMsgTime > entryTimeRef.current && data.lastSenderId !== currentUser.uid) {
            setActivePrivateChat(change.doc.id);
            new Audio('/pop.mp3').play().catch(() => {});
          }
        }
      });
    });
  }, [currentUser]);

  useEffect(() => {
    if (!roomId) return;
    const qMessages = query(collection(db, "rooms", roomId as string, "messages"), orderBy("timestamp", "asc"));
    return onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, [roomId]);

  useEffect(() => {
    if (!roomId || !currentUser || !currentUserName) return;
    const myPresenceDoc = doc(db, "presence", currentUser.uid);
    const updatePresence = async () => {
      await setDoc(myPresenceDoc, {
        userId: currentUser.uid, userName: currentUserName, roomId, lastSeen: serverTimestamp(),
        role: isSuperAdmin ? 'admin' : (roomData?.moderators?.includes(currentUser.uid) ? 'mod' : 'user')
      });
      if (!hasJoinedRef.current) {
        await addDoc(collection(db, "rooms", roomId as string, "messages"), {
          text: `دخل ${currentUserName} الغرفة`, type: "system", timestamp: serverTimestamp(), userId: "system"
        });
        hasJoinedRef.current = true;
      }
    };
    updatePresence();
    const heartbeat = setInterval(updatePresence, 30000);
    const qPresence = query(collection(db, "presence"), where("roomId", "==", roomId));
    const unsub = onSnapshot(qPresence, (snap) => {
      const now = Date.now();
      // إصلاح مشكلة التكرار: استخدام Map لضمان فرادة الـ userId
      const usersMap = new Map();
      snap.docs.forEach(d => {
        const u = d.data();
        if (u.userId !== currentUser.uid) {
          const lastSeenMillis = u.lastSeen?.toMillis ? u.lastSeen.toMillis() : now;
          if (now - lastSeenMillis < 150000) {
            usersMap.set(u.userId, u);
          }
        }
      });
      const activeUsers = Array.from(usersMap.values());
      const sorted = activeUsers.sort((a: any, b: any) => {
        const priority: any = { admin: 1, mod: 2, user: 3 };
        return priority[a.role || 'user'] - priority[b.role || 'user'];
      });
      setUsersInRoom(sorted);
    });
    return () => { clearInterval(heartbeat); unsub(); deleteDoc(myPresenceDoc).catch(() => {}); };
  }, [roomId, currentUser, roomData, currentUserName, isSuperAdmin]);

  const handleAdminAction = async (action: string, value?: any) => {
    const userId = showContextMenu.userId;
    const roomRef = doc(db, "rooms", roomId as string);
    const userRef = doc(db, "users", userId);
    try {
      switch(action) {
        case "kick": await updateDoc(userRef, { kickedFrom: roomId }); break;
        case "ban":
          await updateDoc(roomRef, { bannedUsers: arrayUnion(userId) });
          await updateDoc(userRef, { kickedFrom: roomId, isGlobalMuted: true });
          break;
        case "toggleMod": await updateDoc(roomRef, { moderators: roomData?.moderators?.includes(userId) ? arrayRemove(userId) : arrayUnion(userId) }); break;
        case "mute": await updateDoc(userRef, { isGlobalMuted: true }); break;
        case "unmute": await updateDoc(userRef, { isGlobalMuted: false, muteExpiry: null }); break;
      }
    } catch (e) { console.error(e); }
    setShowContextMenu({ ...showContextMenu, visible: false });
  };

  if (!currentUser) return null;

  return (
    <div style={styles.container}>
      <div style={styles.chatArea}>
        <div style={styles.header}>
          <button onClick={() => router.push("/rooms")} style={styles.backBtn}>←</button>
          <h2>{roomName}</h2>
        </div>
        <div style={styles.messagesArea}>
          {messages.map((msg) => (
            <div key={msg.id} style={msg.type === "system" ? styles.systemMsg : {
              ...styles.message,
              alignSelf: msg.userId === currentUser.uid ? "flex-end" : "flex-start",
              backgroundColor: msg.userId === currentUser.uid ? (msg.role === 'admin' ? "#FFD700" : "#e94560") : "#fff",
              color: msg.userId === currentUser.uid ? (msg.role === 'admin' ? "#000" : "#fff") : "#333",
              border: msg.role === 'admin' ? "2px solid #DAA520" : "none"
            }}>
              {msg.type !== "system" && <strong>{msg.userName} {msg.role === 'mod' && <span style={{fontSize:'0.7rem', color:'#007bff'}}>(مشرف)</span>}: </strong>}
              {msg.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!newMessage.trim() || isMuted) return;
          await addDoc(collection(db, "rooms", roomId as string, "messages"), {
            text: newMessage, userId: currentUser.uid, userName: currentUserName, timestamp: serverTimestamp(), type: "user",
            role: isSuperAdmin ? 'admin' : (roomData?.moderators?.includes(currentUser.uid) ? 'mod' : 'user')
          });
          setNewMessage("");
        }} style={styles.inputForm}>
          <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder={isMuted ? "أنت مكتوم" : "اكتب هنا..."} style={styles.input} disabled={isMuted} />
          <button type="submit" style={styles.sendBtn} disabled={isMuted}>إرسال</button>
        </form>
      </div>

      <div style={styles.sidebar}>
        <h3>المتصلون</h3>
        <div style={styles.userList}>
          <div style={{...styles.userItem, color: isSuperAdmin ? '#DAA520' : (isModerator ? '#007bff' : 'inherit'), fontWeight: 'bold'}}>
            🟢 {currentUserName}
          </div>
          {usersInRoom.map((u) => (
            <div key={u.userId} style={{...styles.userItem, color: u.role === 'admin' ? '#DAA520' : (u.role === 'mod' ? '#007bff' : 'inherit'), fontWeight: u.role !== 'user' ? 'bold' : 'normal'}}
                 onClick={(e) => { e.stopPropagation(); setShowContextMenu({ visible: true, x: e.clientX, y: e.clientY, userId: u.userId, userName: u.userName, role: u.role }); }}>
              🟢 {u.userName} {u.role === 'mod' && <span style={{fontSize:'0.7rem'}}>(مشرف)</span>}
            </div>
          ))}
        </div>
      </div>

      {activePrivateChat && <PrivateChatWindow conversationId={activePrivateChat} currentUser={currentUser} onClose={() => setActivePrivateChat(null)} />}

      {showContextMenu.visible && (
        <div ref={contextMenuRef} style={{ ...styles.menu, top: Math.min(showContextMenu.y, typeof window !== 'undefined' ? window.innerHeight - 250 : 0), left: Math.max(10, showContextMenu.x - 160) }}>
          <div onClick={async () => {
             const conversationId = [currentUser.uid, showContextMenu.userId].sort().join('_');
             const convRef = doc(db, "conversations", conversationId);
             const convSnap = await getDoc(convRef);
             if (!convSnap.exists()) {
               await setDoc(convRef, { participants: [currentUser.uid, showContextMenu.userId], participantsDetails: { [currentUser.uid]: { displayName: currentUserName }, [showContextMenu.userId]: { displayName: showContextMenu.userName } }, createdAt: serverTimestamp() });
             }
             setActivePrivateChat(conversationId);
             setShowContextMenu({ ...showContextMenu, visible: false });
          }} style={styles.menuItem}>💬 رسالة خاصة</div>
          {isSuperAdmin && showContextMenu.userId !== currentUser.uid && (
            <>
              <div style={styles.divider}></div>
              <div onClick={() => handleAdminAction("toggleMod")} style={{...styles.menuItem, color: '#007bff', fontWeight: 'bold'}}>
                🎖️ تبديل الإشراف
              </div>
              <div onClick={() => handleAdminAction("kick")} style={styles.menuItem}>👢 طرد</div>
              <div onClick={() => handleAdminAction("mute")} style={styles.menuItem}>🔇 كتم</div>
              <div onClick={() => handleAdminAction("unmute")} style={styles.menuItem}>🔊 فك كتم</div>
              <div onClick={() => handleAdminAction("ban")} style={{...styles.menuItem, color: 'red'}}>⛔ حظر</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { display: "flex", height: "100vh", direction: "rtl", fontFamily: "sans-serif" },
  chatArea: { flex: 3, display: "flex", flexDirection: "column" },
  header: { padding: "1rem", borderBottom: "1px solid #eee", display: "flex", gap: "1rem" },
  backBtn: { border: "none", background: "#eee", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer" },
  messagesArea: { flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", backgroundColor: "#f5f5f5" },
  message: { padding: "0.5rem 1rem", borderRadius: "10px", maxWidth: "70%", boxShadow: "0 1px 2px rgba(0,0,0,0.1)" },
  systemMsg: { alignSelf: "center", fontSize: "0.75rem", color: "#888", backgroundColor: "#eee", padding: "2px 10px", borderRadius: "10px" },
  inputForm: { padding: "1rem", display: "flex", gap: "0.5rem", borderTop: "1px solid #eee" },
  input: { flex: 1, padding: "0.8rem", borderRadius: "20px", border: "1px solid #ddd", outline: "none" },
  sendBtn: { background: "#e94560", color: "#fff", border: "none", padding: "0.5rem 1.5rem", borderRadius: "20px", cursor: "pointer" },
  sidebar: { flex: 1, borderRight: "1px solid #eee", padding: "1rem", backgroundColor: "#fff" },
  userItem: { padding: "0.8rem", cursor: "pointer", borderBottom: "1px solid #f9f9f9" },
  menu: { position: "fixed", background: "#fff", border: "1px solid #ddd", borderRadius: "10px", boxShadow: "0 5px 20px rgba(0,0,0,0.2)", zIndex: 3000, minWidth: '160px', padding: '5px' },
  menuItem: { padding: "0.7rem 1rem", cursor: "pointer", fontSize: "0.85rem", borderBottom: '1px solid #f5f5f5' },
  divider: { height: '1px', backgroundColor: '#eee', margin: '5px 0' },
};
