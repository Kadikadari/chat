import { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, onSnapshot, orderBy, Timestamp } from "firebase/firestore";

export interface IncomingMessage {
  id: string;
  conversationId: string;
  text: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  timestamp: any;
  isRead: boolean;
}

interface UseIncomingMessagesReturn {
  incomingMessages: IncomingMessage[];
  hasNewMessage: boolean;
  clearNotification: () => void;
}

export function useIncomingMessages(): UseIncomingMessagesReturn {
  const [incomingMessages, setIncomingMessages] = useState<IncomingMessage[]>([]);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const startTimeRef = useRef<number>(Date.now()); // تسجيل وقت تشغيل التطبيق حالياً

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const conversationsRef = collection(db, "conversations");
    const qConversations = query(
      conversationsRef,
      where("participants", "array-contains", user.uid)
    );

    const unsubscribeConversations = onSnapshot(qConversations, (snapshot) => {
      const conversationIds = snapshot.docs.map((doc) => doc.id);
      if (conversationIds.length === 0) return;

      const unsubscribers: (() => void)[] = [];

      conversationIds.forEach((convId) => {
        const messagesRef = collection(db, "conversations", convId, "messages");
        // نطلب الرسائل مرتبة زمنياً
        const qMessages = query(messagesRef, orderBy("timestamp", "desc"));

        const unsubscribeMessages = onSnapshot(qMessages, (msgSnapshot) => {
          msgSnapshot.docChanges().forEach((change) => {
            // نهتم فقط بالرسائل التي تضاف "الآن"
            if (change.type === "added") {
              const messageData = change.doc.data();
              const msgTime = messageData.timestamp?.toMillis() || Date.now();

              // الفلتر السحري:
              // 1. يجب أن يكون وقت الرسالة "بعد" وقت دخول المستخدم الحالي للموقع
              // 2. يجب أن تكون موجهة للمستخدم الحالي وغير مقروءة
              if (msgTime > startTimeRef.current &&
                  messageData.toUserId === user.uid &&
                  !messageData.isRead) {

                const msg: IncomingMessage = {
                  id: change.doc.id,
                  conversationId: convId,
                  ...messageData,
                } as IncomingMessage;

                setIncomingMessages((prev) => {
                  if (prev.find((m) => m.id === msg.id)) return prev;
                  return [msg, ...prev];
                });
                setHasNewMessage(true);

                try {
                  const audio = new Audio("/pop.mp3");
                  audio.play().catch(() => {});
                } catch (error) {}
              }
            }
          });
        });

        unsubscribers.push(unsubscribeMessages);
      });

      return () => unsubscribers.forEach((unsub) => unsub());
    });

    return () => unsubscribeConversations();
  }, []);

  const clearNotification = () => {
    setHasNewMessage(false);
  };

  return { incomingMessages, hasNewMessage, clearNotification };
}
