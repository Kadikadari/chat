"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { IncomingMessage } from "../hooks/useIncomingMessages";

interface MessageNotificationProps {
  message: IncomingMessage | null;
  onClose: () => void;
  onOpenChat: (conversationId: string) => void;
}

export default function MessageNotification({
  message,
  onClose,
  onOpenChat,
}: MessageNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (message) {
      setIsVisible(true);
      console.log("🔔 عرض إشعار رسالة من:", message.fromUserName);

      // إغلاق الإشعار تلقائياً بعد 8 ثوانٍ إذا لم ينقر عليه المستخدم
      const timer = setTimeout(() => {
        handleClose();
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleOpenChat = () => {
    if (message) {
      onOpenChat(message.conversationId);
      handleClose();
    }
  };

  if (!message || !isVisible) return null;

  return (
    <div style={styles.container}>
      <div style={styles.notification} className="notification-enter">
        {/* أيقونة */}
        <div style={styles.iconArea}>
          <span style={styles.icon}>💬</span>
        </div>

        {/* المحتوى */}
        <div style={styles.content}>
          <div style={styles.header}>
            <h3 style={styles.senderName}>{message.fromUserName}</h3>
            <span style={styles.timestamp}>الآن</span>
          </div>

          <p style={styles.message}>{message.text}</p>

          {/* الأزرار */}
          <div style={styles.actions}>
            <button style={styles.openButton} onClick={handleOpenChat}>
              فتح الرسالة
            </button>
            <button style={styles.closeButton} onClick={handleClose}>
              إغلاق
            </button>
          </div>
        </div>

        {/* زر الإغلاق السريع */}
        <button
          style={styles.quickClose}
          onClick={handleClose}
          title="إغلاق"
        >
          ✕
        </button>
      </div>

      {/* الخلفية الشفافة */}
      <div style={styles.backdrop} onClick={handleClose} />
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    pointerEvents: "auto",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
  },
  notification: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
    padding: "24px",
    maxWidth: "420px",
    width: "90%",
    display: "flex",
    gap: "16px",
    zIndex: 10000,
    animation: "slideIn 0.3s ease-out",
  },
  iconArea: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    minWidth: "40px",
  },
  icon: {
    fontSize: "28px",
    lineHeight: "1",
  },
  content: {
    flex: 1,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "8px",
  },
  senderName: {
    margin: 0,
    fontSize: "16px",
    fontWeight: "600",
    color: "#1a1a1a",
  },
  timestamp: {
    fontSize: "12px",
    color: "#999",
  },
  message: {
    margin: "12px 0",
    fontSize: "14px",
    color: "#555",
    lineHeight: "1.4",
    wordBreak: "break-word",
  },
  actions: {
    display: "flex",
    gap: "8px",
    marginTop: "16px",
  },
  openButton: {
    flex: 1,
    padding: "10px 16px",
    backgroundColor: "#4CAF50",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "500",
    fontSize: "14px",
    transition: "background-color 0.2s",
  },
  closeButton: {
    padding: "10px 16px",
    backgroundColor: "#f0f0f0",
    color: "#333",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "500",
    fontSize: "14px",
    transition: "background-color 0.2s",
  },
  quickClose: {
    position: "absolute",
    top: "12px",
    right: "12px",
    backgroundColor: "transparent",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    color: "#999",
    padding: "4px",
    minWidth: "auto",
  },
};

// إضافة الأنيميشن
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translate(-50%, -60%);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%);
      }
    }
    .notification-enter {
      animation: slideIn 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);
}
