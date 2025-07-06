import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

type VoiceItem = {
  senderName: string;
  audioUrl: string;
  createdAt: Timestamp | null;
};

export default function VoiceDisplayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    const fetchVoices = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "events", eventId, "voices"),
          where("visibility", "==", "public"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const voiceList: VoiceItem[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            senderName: data.senderName || "Anonim",
            audioUrl: data.audioUrl,
            createdAt: data.createdAt || null,
          };
        });
        setVoices(voiceList);
      } catch (error) {
        console.error("Ses kayıtları alınırken hata:", error);
      }
      setLoading(false);
    };

    fetchVoices();
  }, [eventId]);

  const formatDate = (timestamp: Timestamp | null): string => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-center mb-6 text-pink-600">Sesli Mesajlar</h1>

      {loading && (
        <p className="text-center text-gray-500">Yükleniyor...</p>
      )}

      {!loading && voices.length === 0 && (
        <p className="text-center text-gray-500">Henüz herkese açık bir sesli mesaj yok.</p>
      )}

      <div className="space-y-4">
        {voices.map((voice, index) => (
          <div
            key={index}
            className="bg-white border border-gray-300 shadow rounded-lg p-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-pink-500">
                {voice.senderName}
              </h3>
              <span className="text-sm text-gray-500">
                {formatDate(voice.createdAt)}
              </span>
            </div>
            <audio controls src={voice.audioUrl} className="w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
