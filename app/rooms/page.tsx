// app/rooms/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";

const ADMIN_UIDS = [
  "DySgWK8YlHbgQqSgbtL3eznw7lh2",
  "fhHNmiIGCHMLCQtzneMaqKMutdW2",
  "YCl67FH3hjfH7bcOnBNn0JI67273",
  "9AHfCSHqu0MzOKoCEL7DS1hAcox2"
];

const DEFAULT_ROOMS = ["عام", "مصر", "الخليج", "بلاد الشام", "العراق", "بلاد المغرب العربي", "عرب اوروبا", "السودان والصومال"];

export default function RoomsPage() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [incomingMsg, setIncomingMsg] = useState<any>(null);
  const entryTime = useRef(Date.now());
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) router.push("/");
      else setIsAdmin(ADMIN_UIDS.includes(user.uid));
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, "conversations"), where("participants", "array-contains", auth.currentUser.uid));
    return onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const data = change.doc.data();
          if (data.lastMessageTime?.toMillis() > entryTime.current && data.lastSenderId !== auth.currentUser?.uid) {
            setIncomingMsg({ id: change.doc.id });
            try { new Audio('/pop.mp3').play(); } catch(e) {}
          }
        }
      });
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, "rooms"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snapshot) => {
      let roomsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRooms(roomsData);
      setLoading(false);
    });
  }, []);

  if (loading) return <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh'}}>جاري التحميل...</div>;

  return (
    <div style={styles.container}>
      {incomingMsg && (
        <div style={styles.alert}>
          <p>📬 رسالة خاصة جديدة!</p>
          <button onClick={() => setIncomingMsg(null)} style={styles.alertBtn}>إغلاق</button>
        </div>
      )}
      <div style={styles.topBar}>
        <h1 style={styles.header}>غرف الدردشة</h1>
        {isAdmin && <button onClick={() => router.push("/admin")} style={styles.adminLink}>⚙️ لوحة التحكم</button>}
      </div>
      <div style={styles.roomList}>
        {rooms.map((room) => (
          <div key={room.id}
            style={{...styles.roomCard, transform: hoveredRoom === room.id ? "scale(1.02)" : "scale(1)"}}
            onMouseEnter={() => setHoveredRoom(room.id)}
            onMouseLeave={() => setHoveredRoom(null)}
            onClick={() => router.push(`/room/${room.id}`)}
          >
            <h2 style={styles.roomName}>{room.name}</h2>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { minHeight: "100vh", backgroundColor: "#f0f2f5", padding: "2rem", direction: "rtl", fontFamily: "sans-serif" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: "800px", margin: "0 auto 2rem" },
  header: { color: "#1a1a2e", margin: 0 },
  adminLink: { padding: "0.5rem 1rem", backgroundColor: "#0f3460", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer" },
  roomList: { display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "800px", margin: "0 auto" },
  roomCard: { background: "linear-gradient(135deg, #e94560 0%, #0f3460 100%)", padding: "1.5rem", borderRadius: "12px", cursor: "pointer", textAlign: "center", color: "white", transition: "0.3s" },
  roomName: { margin: 0, fontSize: "1.3rem" },
  alert: { position: 'fixed', top: '20px', left: '20px', background: '#fff', padding: '15px', borderRadius: '10px', boxShadow: '0 5px 15px rgba(0,0,0,0.2)', zIndex: 10000, borderLeft: '5px solid #e94560', textAlign: 'center' },
  alertBtn: { marginTop: '10px', padding: '5px 10px', background: '#eee', border: 'none', borderRadius: '5px', cursor: 'pointer' }
};
