import { useNavigate, useParams } from "react-router-dom";
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

type MemoryItem = {
  senderName: string;
  memoryText: string;
  createdAt: Timestamp | null;
};

export default function MemoryDisplayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => {
    if (!eventId) return;

    const fetchMemories = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "events", eventId, "memory"),
          where("visibility", "==", "public"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const memoryList: MemoryItem[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            senderName: data.senderName || "Anonim",
            memoryText: data.memoryText || "",
            createdAt: data.createdAt || null,
          };
        });
        setMemories(memoryList);
      } catch (error) {
        console.error("Anılar yüklenirken hata:", error);
      }
      setLoading(false);
    };

    fetchMemories();
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
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-4xl font-bold text-center mb-8 text-pink-600">
        Anılar
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate(`/${eventId}`)}
          className="w-full px-4 py-4 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📸 Fotoğraf&Video Yükle
        </button>

        <button
          onClick={() => navigate(`/${eventId}/gallery`)}
          className="w-full px-4 py-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📸 Galeri
        </button>

        <button
          onClick={() => navigate(`/${eventId}/voiceUpload`)}
          className="w-full px-4 py-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          🔊 Sesli Anı Defteri
        </button>
      </div>
      {loading && (
        <p className="text-center text-gray-600 text-lg">Yükleniyor...</p>
      )}
      <button
        onClick={() => navigate(`/${eventId}/memoryUpload`)}
        className="px-4 py-2 mb-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors duration-200"
      >
        Anı Gönder
      </button>
      {!loading && memories.length === 0 && (
        <p className="text-center text-gray-600 text-lg">
          Henüz herkese açık bir anı yok.
        </p>
      )}

      <div className="space-y-4">
        {memories.map((memory, index) => (
          <div
            key={index}
            className="bg-white border border-gray-300 rounded-lg shadow-md p-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-pink-500">
                {memory.senderName}
              </h3>
            </div>
            <p className="text-gray-800 whitespace-pre-line">
              {memory.memoryText}
            </p>

            <span className="text-sm text-gray-500">
              {formatDate(memory.createdAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
