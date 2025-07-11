import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebaseConfig";
import {
  collection,
  query,
  orderBy,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import Swal from "sweetalert2";

type VoiceItem = {
  id: string;
  senderName: string;
  audioUrl: string;
  visibility: string;
  createdAt: Timestamp | null;
};

export default function AdminVoiceUploadPage() {
  const { eventId } = useParams<{ eventId: string }>();

  const [eventName, setEventName] = useState("");

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [adminInfo, setAdminInfo] = useState<{
    adminId: string;
    adminPass: string;
  }>({
    adminId: "",
    adminPass: "",
  });
  const [isAuthorized, setIsAuthorized] = useState(false);
  useEffect(() => {
    if (!eventId) return;
    const cachedLogin = localStorage.getItem(`admin-login-${eventId}`);
    if (cachedLogin === "true") {
      setIsAuthorized(true);
    }
    const fetchEvent = async () => {
      try {
        const docRef = doc(db, "events", eventId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setEventName(data.eventName || "");
          setAdminInfo({
            adminId: data.adminId || "",
            adminPass: data.adminPass || "",
          });
        } else {
          setEventName("");
        }
      } catch (error) {
        console.error("Event verisi alınırken hata:", error);
      }
    };
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const fetchVoices = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "events", eventId, "voices"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const voiceList: VoiceItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            senderName: data.senderName || "Anonim",
            audioUrl: data.audioUrl,
            visibility: data.visibility || "public",
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

  const toggleVisibility = async (index: number) => {
    if (!eventId) return;

    const voiceDocRef = doc(db, "events", eventId, "voices", voices[index].id);

    try {
      const newVisibility =
        voices[index].visibility === "public" ? "private" : "public";

      await updateDoc(voiceDocRef, {
        visibility: newVisibility,
      });

      setVoices((prev) => {
        const copy = [...prev];
        copy[index] = {
          ...copy[index],
          visibility: newVisibility,
        };
        return copy;
      });

      Swal.fire({
        title: "Başarılı!",
        text: `Gizlilik durumu "${newVisibility}" olarak değiştirildi.`,
        icon: "success",
      });
    } catch (error) {
      console.error("Gizlilik güncellenemedi:", error);
      Swal.fire({
        title: "Hata!",
        text: "Gizlilik durumu güncellenemedi.",
        icon: "error",
      });
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <h2 className="text-2xl text-black font-bold mb-4">Yönetici Girişi</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const id = formData.get("id")?.toString().trim();
            const pass = formData.get("pass")?.toString().trim();
            if (id === adminInfo.adminId && pass === adminInfo.adminPass) {
              localStorage.setItem(`admin-login-${eventId}`, "true");
              setIsAuthorized(true);
            } else {
              Swal.fire({
                icon: "error",
                title: "Giriş Başarısız",
                text: "ID veya şifre hatalı.",
              });
            }
          }}
          className="flex flex-col gap-4 w-full max-w-sm"
        >
          <input
            name="id"
            type="text"
            placeholder="Admin ID"
            className="border border-black text-black rounded px-4 py-2"
            required
          />
          <input
            name="pass"
            type="password"
            placeholder="Admin Şifre"
            className="border border-black text-black rounded px-4 py-2"
            required
          />
          <button
            type="submit"
            className="bg-pink-600 hover:bg-pink-700 text-white py-2 rounded"
          >
            Giriş Yap
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1
        className="text-4xl text-center mb-8 text-black"
        style={{ fontFamily: "'Ms Madi', cursive" }}
      >
        {eventName}
      </h1>

      <h1 className="text-3xl font-bold text-center text-pink-600 mb-6">
        Sesli Anı Defteri
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate(`/${eventId}/adminGallery`)}
          className="w-full px-4 py-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📸 Galeri
        </button>
        <button
          onClick={() => navigate(`/${eventId}/adminMemory`)}
          className="w-full px-4 py-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📖 Anı Defteri
        </button>
        <button
          onClick={() => {
            localStorage.removeItem(`admin-login-${eventId}`);
            setIsAuthorized(false);
          }}
          className="fixed top-4 right-4 text-sm bg-gray-200 px-3 py-1 rounded"
        >
          Çıkış Yap
        </button>
      </div>

      {loading && <p className="text-center text-gray-500">Yükleniyor...</p>}

      {!loading && voices.length === 0 && (
        <p className="text-center text-gray-500">Henüz bir sesli mesaj yok.</p>
      )}

      <div className="space-y-4">
        {voices.map((voice, index) => (
          <div
            key={voice.id}
            className="bg-white border border-gray-300 shadow rounded-lg p-4"
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-semibold text-pink-500">
                {voice.senderName}
              </h3>
              <button
                onClick={() => toggleVisibility(index)}
                className={`px-3 py-1 rounded text-sm font-semibold ${
                  voice.visibility === "public"
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                }`}
              >
                {voice.visibility === "public"
                  ? "Gizliliği Özel Yap"
                  : "Gizliliği Açık Yap"}
              </button>
            </div>
            <audio controls src={voice.audioUrl} className="w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
