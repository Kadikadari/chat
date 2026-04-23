// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  arrayUnion,
  arrayRemove,
  addDoc,
  serverTimestamp,
  onSnapshot,
  where
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

// قائمة المدراء المعتمدين (أصحاب الموقع)
const ADMIN_UIDS = [
  "DySgWK8YlHbgQqSgbtL3eznw7lh2",
  "fhHNmiIGCHMLCQtzneMaqKMutdW2",
  "YCl67FH3hjfH7bcOnBNn0JI67273",
  "9AHfCSHqu0MzOKoCEL7DS1hAcox2"
];

interface Room {
  id: string;
  name: string;
  moderators?: string[];
  bannedUsers?: string[];
}

interface UserProfile {
  uid: string;
  nickname: string;
}

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [usersInSelectedRoom, setUsersInSelectedRoom] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newRoomName, setNewRoomName] = useState("");
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && ADMIN_UIDS.includes(user.uid)) {
        setIsAdmin(true);
        fetchGlobalData();
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchGlobalData = async () => {
    setLoading(true);
    try {
      const roomsSnap = await getDocs(collection(db, "rooms"));
      setRooms(roomsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Room)));
      const usersSnap = await getDocs(collection(db, "users"));
      setUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedRoomId) {
      setUsersInSelectedRoom([]);
      return;
    }
    const q = query(collection(db, "presence"), where("roomId", "==", selectedRoomId));
    return onSnapshot(q, (snapshot) => {
      const now = Date.now();
      setUsersInSelectedRoom(snapshot.docs.map(d => d.data()).filter((u:any) => (now - (u.lastSeen?.toMillis() || 0)) < 150000));
    });
  }, [selectedRoomId]);

  const updateRoomName = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    await updateDoc(doc(db, "rooms", id), { name: newName });
    fetchGlobalData();
  };

  const createCustomRoom = async () => {
    if (!newRoomName.trim()) return;
    await addDoc(collection(db, "rooms"), {
      name: newRoomName,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser?.uid,
      moderators: [],
      bannedUsers: []
    });
    setNewRoomName("");
    fetchGlobalData();
  };

  const adminUserAction = async (userId: string, action: "kick" | "ban" | "unban") => {
    if (!selectedRoomId) return;
    const roomRef = doc(db, "rooms", selectedRoomId);
    const userRef = doc(db, "users", userId);

    if (action === "kick") {
      await updateDoc(userRef, { kickedFrom: selectedRoomId });
    } else if (action === "ban") {
      await updateDoc(roomRef, { bannedUsers: arrayUnion(userId) });
      await updateDoc(userRef, { kickedFrom: selectedRoomId, isGlobalMuted: true });
    } else if (action === "unban") {
      await updateDoc(roomRef, { bannedUsers: arrayRemove(userId) });
      await updateDoc(userRef, { isGlobalMuted: false });
    }
    fetchGlobalData();
  };

  if (!isAdmin) return null;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>لوحة القيادة والرقابة 👑</h1>
        <button onClick={() => router.push("/rooms")} style={styles.backBtn}>خروج للموقع</button>
      </header>

      <div style={styles.layout}>
        <div style={styles.sidebar}>
          <div style={styles.card}>
            <h3>إنشاء غرفة جديدة</h3>
            <div style={styles.flex}>
              <input value={newRoomName} onChange={(e)=>setNewRoomName(e.target.value)} placeholder="اسم الغرفة..." style={styles.input}/>
              <button onClick={createCustomRoom} style={styles.addBtn}>إضافة</button>
            </div>
          </div>

          <div style={styles.roomList}>
            <h3>قائمة الغرف ({rooms.length})</h3>
            {rooms.map(room => (
              <div key={room.id}
                   onClick={() => setSelectedRoomId(room.id)}
                   style={{...styles.roomItem, borderRight: selectedRoomId === room.id ? '5px solid #e94560' : 'none'}}>
                <input
                  defaultValue={room.name}
                  onBlur={(e) => updateRoomName(room.id, e.target.value)}
                  style={styles.roomInput}
                />
                <button onClick={()=>deleteDoc(doc(db,"rooms",room.id)).then(fetchGlobalData)} style={styles.miniDel}>حذف</button>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.main}>
          {selectedRoomId ? (
            <div style={styles.card}>
              <h2>المتواجدون حالياً في: {rooms.find(r=>r.id === selectedRoomId)?.name}</h2>
              <div style={styles.userGrid}>
                {usersInSelectedRoom.length > 0 ? usersInSelectedRoom.map(u => (
                  <div key={u.userId} style={styles.userCard}>
                    <span>🟢 {u.userName}</span>
                    <div style={styles.actions}>
                      <button onClick={()=>adminUserAction(u.userId, "kick")} style={styles.actionBtn}>طرد</button>
                      <button onClick={()=>adminUserAction(u.userId, "ban")} style={{...styles.actionBtn, color: 'red'}}>حظر</button>
                    </div>
                  </div>
                )) : <p>لا يوجد متواجدون حالياً</p>}
              </div>

              <div style={{marginTop: '2rem'}}>
                <h3>قائمة المحظورين نهائياً</h3>
                <div style={styles.userGrid}>
                  {rooms.find(r=>r.id === selectedRoomId)?.bannedUsers?.map(uid => (
                    <div key={uid} style={styles.userCard}>
                      <span>🚫 {users.find(user=>user.uid === uid)?.nickname || uid}</span>
                      <button onClick={()=>adminUserAction(uid, "unban")} style={styles.unbanBtn}>فك الحظر</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.welcome}>اختر غرفة من القائمة لبدء الرقابة والتحكم</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { padding: "1.5rem", direction: "rtl", fontFamily: "sans-serif", backgroundColor: "#f4f7f6", minHeight: "100vh" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", background: "#0f3460", color: "white", padding: "1rem", borderRadius: "10px" },
  backBtn: { background: "#e94560", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "5px", cursor: "pointer" },
  layout: { display: "flex", gap: "1.5rem" },
  sidebar: { flex: 1, display: "flex", flexDirection: "column", gap: "1rem" },
  main: { flex: 2 },
  card: { background: "white", padding: "1.5rem", borderRadius: "10px", boxShadow: "0 2px 5px rgba(0,0,0,0.1)" },
  flex: { display: "flex", gap: "0.5rem" },
  input: { flex: 1, padding: "0.5rem", borderRadius: "5px", border: "1px solid #ddd" },
  addBtn: { background: "#28a745", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "5px", cursor: "pointer" },
  roomList: { display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" },
  roomItem: { background: "white", padding: "0.8rem", borderRadius: "5px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" },
  roomInput: { border: "none", background: "transparent", fontWeight: "bold", fontSize: "1rem", cursor: "text", width: "70%" },
  miniDel: { color: "#ff4d4d", background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem" },
  userGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "1rem" },
  userCard: { border: "1px solid #eee", padding: "0.8rem", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  actions: { display: "flex", gap: "5px" },
  actionBtn: { border: "1px solid #ddd", background: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "0.8rem", cursor: "pointer" },
  unbanBtn: { background: "#007bff", color: "white", border: "none", padding: "3px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" },
  welcome: { height: "300px", display: "flex", justifyContent: "center", alignItems: "center", color: "#888", fontSize: "1.2rem", background: "#fff", borderRadius: "10px", border: "2px dashed #ddd" }
};
