// app/rooms/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { useIncomingMessages, type IncomingMessage } from "@/lib/hooks/useIncomingMessages";
import MessageNotification from "@/lib/hooks/components/MessageNotification";

const ADMIN_UIDS = [
  "DySgWK8YlHbgQqSgbtL3eznw7lh2",
  "fhHNmiIGCHMLCQtzneMaqKMutdW2",
  "YCl67FH3hjfH7bcOnBNn0JI67273"
];

interface Room {
  id: string;
  name: string;
  createdAt: any;
}

const DEFAULT_ROOMS = [
  "عام", "مصر", "الخليج", "بلاد الشام", "العراق", "بلاد المغرب العربي", "عرب اوروبا", "السودان والصومال"
];

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeMessage, setActiveMessage] = useState<IncomingMessage | null>(null);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const router = useRouter();
  const { incomingMessages, hasNewMessage, clearNotification } = useIncomingMessages();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push("/");
      } else {
        if (ADMIN_UIDS.includes(user.uid)) {
          setIsAdmin(true);
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (hasNewMessage && incomingMessages.length > 0) {
      setActiveMessage(incomingMessages[0]);
    }
  }, [hasNewMessage, incomingMessages]);

  useEffect(() => {
    const q = query(collection(db, "rooms"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Room[];

      if (roomsData.length === 0 && isAdmin) {
        for (const name of DEFAULT_ROOMS) {
          await addDoc(collection(db, "rooms"), {
            name,
            createdAt: serverTimestamp(),
            createdBy: auth.currentUser?.uid,
            moderators: [],
            bannedUsers: []
          });
        }
      }
      setRooms(roomsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  if (loading) return <div style={styles.loading}>جاري التحميل...</div>;

  return (
    <div style={styles.container}>
      <MessageNotification
        message={activeMessage}
        onClose={() => setActiveMessage(null)}
        onOpenChat={(id) => { setActiveMessage(null); router.push(`/private/${id}`); }}
      />

      <div style={styles.topBar}>
        <h1 style={styles.header}>غرف الدردشة العربية</h1>
        {isAdmin && (
          <button onClick={() => router.push("/admin")} style={styles.adminLink}>
            ⚙️ لوحة التحكم
          </button>
        )}
      </div>

      <div style={styles.roomList}>
        {rooms.map((room) => (
          <div
            key={room.id}
            style={{
              ...styles.roomCard,
              transform: hoveredRoom === room.id ? "scale(1.03)" : "scale(1)",
              boxShadow: hoveredRoom === room.id ? "0 8px 25px rgba(0,0,0,0.2)" : "0 4px 15px rgba(0,0,0,0.1)",
              filter: hoveredRoom === room.id ? "brightness(1.1)" : "brightness(1)",
            }}
            onMouseEnter={() => setHoveredRoom(room.id)}
            onMouseLeave={() => setHoveredRoom(null)}
            onClick={() => router.push(`/room/${room.id}`)}
          >
            <h2 style={styles.roomName}>{room.name}</h2>
          </div>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '3rem', color: '#888', fontSize: '0.9rem' }}>
        استمتع بالدردشة مع أصدقائك في بيئة آمنة وممتعة 😊
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { minHeight: "100vh", backgroundColor: "#f0f2f5", padding: "2rem", fontFamily: "sans-serif", direction: "rtl" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "800px", margin: "0 auto 2rem" },
  header: { color: "#1a1a2e", margin: 0, fontSize: "1.8rem" },
  adminLink: { padding: "0.5rem 1rem", backgroundColor: "#0f3460", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" },
  roomList: { display: "flex", flexDirection: "column", gap: "1.2rem", maxWidth: "800px", margin: "0 auto" },
  roomCard: {
    background: "linear-gradient(135deg, #e94560 0%, #0f3460 100%)",
    padding: "1.8rem",
    borderRadius: "15px",
    cursor: "pointer",
    textAlign: "center",
    color: "white",
    transition: "all 0.3s ease",
    userSelect: "none"
  },
  roomName: { margin: 0, fontSize: "1.5rem", fontWeight: "bold" },
  loading: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", fontSize: "1.2rem" },
};
