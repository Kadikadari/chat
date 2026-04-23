// app/page.tsx
"use client";

import { useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  updateProfile,
} from "firebase/auth";
import { collection, doc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

type AuthMode = "guest" | "login" | "register";

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("guest");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) {
      setError("يرجى إدخال لقب للمتابعة");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const userCredential = await signInAnonymously(auth);
      const usersCollection = collection(db, "users");
      const guestName = "ضيف_" + userCredential.user.uid.slice(0, 6);

      await setDoc(doc(usersCollection, userCredential.user.uid), {
        uid: userCredential.user.uid,
        displayName: guestName,
        nickname: nickname.trim(),
        isAnonymous: true,
        createdAt: new Date(),
      });

      router.push("/rooms");
    } catch (err: any) {
      setError(err.message || "حدث خطأ ما");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "login") {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        // تحديث اللقب عند تسجيل الدخول إذا تم إدخاله
        if (nickname.trim()) {
          const userDocRef = doc(db, "users", userCredential.user.uid);
          await setDoc(userDocRef, { nickname: nickname.trim() }, { merge: true });
        }
      } else if (mode === "register") {
        if (!displayName.trim() || !nickname.trim()) {
          setError("يرجى ملء جميع الحقول");
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: displayName.trim() });

        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: email,
          displayName: displayName.trim(),
          nickname: nickname.trim(),
          createdAt: new Date(),
        });
      }
      router.push("/rooms");
    } catch (err: any) {
      setError(err.message || "فشل في تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.background} />
      
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.iconContainer}>💬</div>
          <h1 style={styles.title}>شات غرف الدردشة</h1>
          <p style={styles.subtitle}>
            {mode === "guest" ? "ادخل فوراً وابدأ الدردشة" : mode === "login" ? "تسجيل الدخول للحساب" : "إنشاء حساب جديد"}
          </p>
        </div>

        {/* وضع دخول الضيف (الافتراضي) */}
        {mode === "guest" && (
          <form onSubmit={handleGuestLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>اختر لقباً لك</label>
              <input
                type="text"
                placeholder="مثلاً: الفارس العربي"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                style={styles.input}
                maxLength={20}
                required
              />
            </div>
            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? "جاري الدخول..." : "دخول سريع كضيف 🚀"}
            </button>
          </form>
        )}

        {/* وضع تسجيل الدخول أو التسجيل بالإيميل */}
        {(mode === "login" || mode === "register") && (
          <form onSubmit={handleEmailAuth} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>البريد الإلكتروني</label>
              <input
                type="email"
                placeholder="example@mail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
              />
            </div>

            {mode === "register" && (
              <>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>اسم العرض</label>
                  <input
                    type="text"
                    placeholder="اسمك الحقيقي أو المستعار"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>اللقب في الشات</label>
                  <input
                    type="text"
                    placeholder="اللقب الذي سيظهر للجميع"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
              </>
            )}

            <div style={styles.inputGroup}>
              <label style={styles.label}>كلمة المرور</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? "جاري المعالجة..." : mode === "login" ? "تسجيل دخول" : "إنشاء الحساب"}
            </button>
          </form>
        )}

        {error && <p style={styles.error}>{error}</p>}

        {/* روابط التنقل بين الأوضاع */}
        <div style={styles.footer}>
          {mode === "guest" ? (
            <>
              <p style={{ margin: "10px 0", color: "#666" }}>أو إذا كان لديك حساب:</p>
              <div style={styles.linksRow}>
                <button onClick={() => setMode("login")} style={styles.linkBtn}>تسجيل دخول</button>
                <span style={{ color: "#ccc" }}>|</span>
                <button onClick={() => setMode("register")} style={styles.linkBtn}>إنشاء حساب</button>
              </div>
            </>
          ) : (
            <button onClick={() => setMode("guest")} style={styles.linkBtn}>العودة للدخول كضيف</button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", direction: "rtl", fontFamily: "sans-serif" },
  background: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(135deg, #e94560 0%, #0f3460 100%)", opacity: 0.1, zIndex: -1 },
  card: { backgroundColor: "white", padding: "2.5rem", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.1)", width: "100%", maxWidth: "400px", textAlign: "center" },
  header: { marginBottom: "2rem" },
  iconContainer: { fontSize: "3.5rem", marginBottom: "0.5rem" },
  title: { color: "#1a1a2e", fontSize: "1.8rem", margin: "0.5rem 0" },
  subtitle: { color: "#777", fontSize: "0.9rem" },
  form: { display: "flex", flexDirection: "column", gap: "1.2rem" },
  inputGroup: { textAlign: "right" },
  label: { display: "block", color: "#333", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: "bold" },
  input: { width: "100%", padding: "0.8rem", borderRadius: "10px", border: "1px solid #ddd", fontSize: "1rem", boxSizing: "border-box", outline: "none" },
  button: { backgroundColor: "#e94560", color: "white", padding: "1rem", border: "none", borderRadius: "10px", cursor: "pointer", fontSize: "1rem", fontWeight: "bold", transition: "0.3s" },
  error: { color: "#e94560", marginTop: "1rem", fontSize: "0.85rem" },
  footer: { marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid #eee" },
  linksRow: { display: "flex", justifyContent: "center", gap: "1rem", alignItems: "center" },
  linkBtn: { background: "none", border: "none", color: "#0f3460", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", textDecoration: "underline" },
};
