import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../firebaseConfig";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import Swal from "sweetalert2";

import Recorder from "recorder-js";

type VoiceItem = {
  senderName: string;
  audioUrl: string;
  createdAt: Timestamp | null;
};

export default function VoiceUploadPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [senderName, setSenderName] = useState("");
  const [eventName, setEventName] = useState("");

  const [visibility, setVisibility] = useState("public");
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [voices, setVoices] = useState<VoiceItem[]>([]);

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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      recorderRef.current = new Recorder(audioContext, {
        // optional: specify options here
        // e.g. workerPath: 'recorderWorker.js'
      });
      await recorderRef.current.init(stream);
      recorderRef.current.start();
      setRecording(true);

      // 30 saniyede otomatik durdurma
      setTimeout(() => {
        if (recording) stopRecording();
      }, 30000);
    } catch (error) {
      alert("Mikrofona erişilemiyor: " + error);
    }
  };

  const stopRecording = async () => {
    if (!recorderRef.current) return;
    const { blob } = await recorderRef.current.stop();
    setAudioBlob(blob);
    setRecording(false);
  };

  const handleUpload = async () => {
    if (!audioBlob || !eventId) return;

    setUploading(true);
    try {
      const storage = getStorage();
      const audioRef = ref(storage, `voices/${eventId}/${Date.now()}.wav`);
      await uploadBytes(audioRef, audioBlob);
      const downloadURL = await getDownloadURL(audioRef);

      await addDoc(collection(db, "events", eventId, "voices"), {
        visibility,
        senderName: senderName || "Anonim",
        audioUrl: downloadURL,
        createdAt: serverTimestamp(),
      });

      Swal.fire({
        title: "Yükleme Tamamlandı!",
        text: "Ses kaydı başarıyla yüklendi.",
        icon: "success",
        confirmButtonText: "Tamam",
      });
      setAudioBlob(null);
      setSenderName("");
      setVisibility("public");
    } catch (error) {
      console.error("Ses yüklenemedi:", error);
      Swal.fire({
        title: "Yükleme Başarısız!",
        text: "Ses kaydı yüklenemedi.",
        icon: "error",
        confirmButtonText: "Tamam",
      });
    }
    setUploading(false);
  };

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
          onClick={() => navigate(`/${eventId}`)}
          className="w-full px-4 py-4 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📸 Medya Yükle
        </button>
        <button
          onClick={() => navigate(`/${eventId}/gallery`)}
          className="w-full px-4 py-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📸 Galeri
        </button>
        <button
          onClick={() => navigate(`/${eventId}/memoryUpload`)}
          className="w-full px-4 py-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📖 Anı Defteri
        </button>
      </div>

      <div className="w-full max-w-md mx-auto m-4">
        {/* İsim Girişi */}
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

        {/* Gizlilik Seçimi */}
        <p className="text-pink-500 font-semibold mb-2 text-sm">
          Kimler Görebilsin?
        </p>

        <div
          className="relative flex w-full rounded-full bg-gray-800 text-sm font-medium text-white overflow-hidden cursor-pointer mb-6"
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

      <div className="mb-4 flex flex-col items-center gap-3">
        {!recording && (
          <button
            onClick={startRecording}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg"
          >
            🎙️ Kayda Başla
          </button>
        )}
        {recording && (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg"
          >
            ⏹️ Kaydı Durdur
          </button>
        )}
        {audioBlob && (
          <audio
            controls
            src={URL.createObjectURL(audioBlob)}
            className="w-full"
          />
        )}
      </div>

      <button
        onClick={handleUpload}
        disabled={!audioBlob || uploading}
        className={`w-full py-2 rounded-lg ${
          uploading || !audioBlob
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700"
        } text-white`}
      >
        {uploading ? "Yükleniyor..." : "Gönder"}
      </button>

      <hr className="my-6 border-pink-300" />

      <h2 className="text-lg font-semibold text-center text-pink-600 mb-4">
        Sesli Mesajlar
      </h2>
      {loading && <p className="text-center text-gray-500">Yükleniyor...</p>}

      {!loading && voices.length === 0 && (
        <p className="text-center text-gray-500">
          Henüz herkese açık bir sesli mesaj yok.
        </p>
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
