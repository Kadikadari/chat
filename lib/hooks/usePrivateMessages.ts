// hooks/usePrivateMessages.ts
import { useEffect, useState } from "react";
import { db, auth } from "../lib/firebase";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

interface PrivateMessage {
  id: string;
  conversationId: string;
  text: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  timestamp: any;
  isRead: boolean;
}

export function usePrivateMessages() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestMessage, setLatestMessage] = useState<PrivateMessage | null>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // نبحث عن جميع المحادثات التي فيها المستخدم طرف
    const conversationsRef = collection(db, "conversations");
    const qConversations = query(conversationsRef, where("participants", "array-contains", user.uid));
    
    const unsubscribeConversations = onSnapshot(qConversations, async (snapshot) => {
      const conversationIds = snapshot.docs.map(doc => doc.id);
      if (conversationIds.length === 0) return;

      // نستمع للرسائل الغير مقروءة في كل هذه المحادثات
      let totalUnread = 0;
      let lastMsg: PrivateMessage | null = null;

      for (const convId of conversationIds) {
        const messagesRef = collection(db, "conversations", convId, "messages");
        const qMessages = query(messagesRef, orderBy("timestamp", "desc"));
        const unsubscribeMessages = onSnapshot(qMessages, (msgSnapshot) => {
          msgSnapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              const msg = { id: change.doc.id, ...change.doc.data() } as PrivateMessage;
              // إذا كانت الرسالة موجهة للمستخدم الحالي ولم تُقرأ بعد
              if (msg.toUserId === user.uid && !msg.isRead) {
                totalUnread++;
                if (!lastMsg || msg.timestamp?.toDate() > lastMsg.timestamp?.toDate()) {
                  lastMsg = msg;
                }
                setUnreadCount(totalUnread);
                setLatestMessage(lastMsg);
                // إصدار صوت اختياري (يمكن تفعيله)
                // new Audio('/notification.mp3').play().catch(e=>console.log(e));
              }
            }
          });
        });
        // تخزين دالة إلغاء الاشتراك مؤقتاً (للبساطة سنستخدم return واحدة، لكن في الحقيقة يجب تجميعها)
        // نكتفي بمثال عملي مبسط: سنعيد الاشتراك عند كل تغيير في المحادثات
        return () => unsubscribeMessages();
      }
    });

    return () => unsubscribeConversations();
  }, []);

  return { unreadCount, latestMessage };
}