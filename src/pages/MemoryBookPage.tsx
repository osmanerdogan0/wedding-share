import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  Timestamp,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import Swal from "sweetalert2";
type MemoryItem = {
  senderName: string;
  memoryText: string;
  createdAt: Timestamp | null;
};

export default function MemoryUploadPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [visibility, setVisibility] = useState("public");
  const [uploading, setUploading] = useState(false);
  const [eventName, setEventName] = useState("");
  const [senderName, setSenderName] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const navigate = useNavigate();
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, "events", eventId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEventName(data.eventName || "");
        } else {
          setEventName("");
        }
      } catch (error) {
        console.error("Etkinlik alınırken hata:", error);
      }
    };
    fetchEvent();
  }, [eventId]);

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

  const handleUpload = async () => {
    if (!eventId) return alert("Etkinlik ID bulunamadı");
    if (memoryText.length === 0) return alert("Lütfen anı yazın");

    setUploading(true);

    try {
      await addDoc(collection(db, "events", eventId, "memory"), {
        visibility,
        senderName: senderName || "Anonim",
        memoryText: memoryText || "Anonim",
        createdAt: serverTimestamp(),
      });
      Swal.fire({
        title: "Yükleme Tamamlandı!",
        text: "Anı başarıyla yüklendi.",
        icon: "success",
        confirmButtonText: "Tamam",
      });
    } catch (err) {
      console.error("Yükleme hatası:", err);
      Swal.fire({
        title: "Yükleme Başarısız!",
        text: "Anı yüklenemedi.",
        icon: "error",
        confirmButtonText: "Tamam",
      });
    }

    setUploading(false);
    setSenderName("");
    setMemoryText("");
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1
        className="text-4xl text-center mb-8 text-black"
        style={{ fontFamily: "'Ms Madi', cursive" }}
      >
        {eventName}
      </h1>

      <h1 className="text-3xl font-bold text-center text-pink-600 mb-6">
        Anı Defteri
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

      <div className="w-full max-w-md mx-auto m-4">
        <div className="mb-6">
          <label className="block text-pink-500 font-semibold mb-2 text-sm">
            Kim Gönderiyor?
          </label>
          <input
            type="text"
            placeholder="İsim Soyisim (opsiyonel)"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
        </div>

        <div className="mb-6">
          <label className="block text-pink-500 font-semibold mb-2 text-sm">
            Anı Defteri
          </label>
          <textarea
            placeholder="Bir şeyler yaz..."
            value={memoryText}
            onChange={(e) => setMemoryText(e.target.value)}
            maxLength={300}
            rows={5}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-black placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 resize-none"
          />
          <div className="text-sm text-gray-500 text-right mt-1">
            {memoryText.length}/300 karakter
          </div>
        </div>

        <p className="text-pink-500 font-semibold mb-2 text-sm">
          Kimler Görebilsin?
        </p>

        <div
          className="relative flex w-full rounded-full bg-gray-800 text-sm font-medium text-white overflow-hidden cursor-pointer"
          onClick={() =>
            setVisibility(visibility === "public" ? "private" : "public")
          }
        >
          <div
            className={`absolute left-1 w-[49%] rounded-full bg-white transition-transform duration-300 h-5/6 top-1/2 -translate-y-1/2 ${
              visibility === "public" ? "translate-x-full" : "translate-x-0"
            }`}
          ></div>

          <div className="w-1/2 text-center py-2 z-10">
            <span
              className={
                visibility === "private" ? "text-gray-900" : "text-white"
              }
            >
              Düğün Sahipleri
            </span>
          </div>

          <div className="w-1/2 text-center py-2 z-10">
            <span
              className={
                visibility === "public" ? "text-gray-900" : "text-white"
              }
            >
              Herkese Açık
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading}
        className={`mt-6 w-full py-3 rounded-lg text-white font-semibold transition ${
          uploading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-pink-500 hover:bg-pink-600"
        }`}
      >
        {uploading ? "Gönderiliyor..." : "Gönder"}
      </button>
      <hr className="my-6 border-pink-300" />

      <h2 className="text-lg font-semibold text-center text-pink-600 mb-4">
        Anı Defteri
      </h2>
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
