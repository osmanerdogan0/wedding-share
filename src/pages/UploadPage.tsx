import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebaseConfig";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import heic2any from "heic2any";

export default function UploadPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [visibility, setVisibility] = useState("public");
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [eventName, setEventName] = useState("");
  const [senderName, setSenderName] = useState("");
  const navigate = useNavigate();

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

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.currentTime = 1;

      video.onloadeddata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg"));
        } else {
          reject("Canvas context alınamadı");
        }
      };

      video.onerror = () => reject("Video yüklenemedi");
    });
  };

  async function processImage(file: File): Promise<Blob> {
    let imageBlob: Blob = file;

    if (file.type === "image/heic" || file.type === "image/heif") {
      try {
        const converted = await heic2any({ blob: file, toType: "image/jpeg" });
        imageBlob = Array.isArray(converted) ? converted[0] : converted;
      } catch (e) {
        console.error("HEIC dönüştürme hatası:", e);
        throw e;
      }
    }

    const imageUrl = URL.createObjectURL(imageBlob);
    const img = new Image();

    return new Promise((resolve, reject) => {
      img.onload = () => {
        const scale = 0.75;
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject("Canvas context alınamadı");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Blob oluşturulamadı"));
            resolve(blob);
          },
          "image/jpeg",
          0.85
        );
      };

      img.onerror = reject;
      img.src = imageUrl;
    });
  }

  const handleUpload = async () => {
    if (!eventId) return alert("Etkinlik ID bulunamadı");
    if (files.length === 0) return alert("Lütfen dosya seçin");

    setUploading(true);
    const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

    for (const file of files) {
      try {
        let uploadFile: File | Blob = file;

        if (file.type.startsWith("video")) {
          if (file.size > MAX_VIDEO_SIZE) {
            alert(`Video 100MB'dan büyük: ${file.name}`);
            continue;
          }
        }

        if (file.type.startsWith("image/")) {
          uploadFile = await processImage(file);

          let newName = file.name;
          if (file.type === "image/heic" || file.type === "image/heif") {
            newName = file.name.replace(/\.[^/.]+$/, ".jpg");
          }

          uploadFile = new File([uploadFile], newName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });
        }

        const id = uuidv4();
        const storageRef = ref(storage, `${eventId}/${id}_${(uploadFile as File).name}`);
        await uploadBytes(storageRef, uploadFile);
        const url = await getDownloadURL(storageRef);

        let thumbnailUrl: string | null = null;
        if ((uploadFile as File).type.startsWith("video")) {
          try {
            const base64 = await generateVideoThumbnail(uploadFile as File);
            const blob = await (await fetch(base64)).blob();
            const thumbRef = ref(storage, `${eventId}/thumbnails/${id}_thumb.jpg`);
            await uploadBytes(thumbRef, blob);
            thumbnailUrl = await getDownloadURL(thumbRef);
          } catch (err) {
            console.error("Thumbnail hatası:", err);
          }
        }

        await addDoc(collection(db, "events", eventId, "media"), {
          url,
          type: (uploadFile as File).type.startsWith("video") ? "video" : "image",
          visibility,
          senderName: senderName || "Anonim",
          thumbnail: thumbnailUrl,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error("Yükleme hatası:", err);
        alert(`Yüklenemedi: ${file.name}`);
      }
    }

    alert("Yükleme tamamlandı!");
    setFiles([]);
    setUploading(false);
    setSenderName("");
  };

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-4xl text-center mb-8 text-black" style={{ fontFamily: "'Ms Madi', cursive" }}>
        {eventName}
      </h1>

      <button
        onClick={() => navigate(`/${eventId}/gallery`)}
        className="px-4 py-2 mb-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors duration-200"
      >
        Galeriyi Görüntüle
      </button>

      <label className="block w-full bg-gray-100 border-2 border-dashed border-gray-300 p-6 text-center rounded-lg cursor-pointer hover:border-pink-400 transition">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(e) => {
            const fileList = e.target.files;
            if (!fileList) return;
            const selected = Array.from(fileList);
            if (selected.length > 10) {
              alert("En fazla 10 dosya seçebilirsiniz.");
              return;
            }
            setFiles(selected);
          }}
          className="hidden"
        />

        {files.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 list-none p-0 m-0">
            {files.slice(0, 4).map((file, index) => (
              <li key={index} className="relative">
                {file.type.startsWith("image") ? (
                  file.type === "image/heic" || file.type === "image/heif" ? (
                    <div className="w-20 h-20 rounded-md bg-gray-700 bg-opacity-80 flex items-center justify-center text-white text-xs font-semibold">
                      HEIC Dosyası
                    </div>
                  ) : (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="rounded-md w-20 h-20 object-cover"
                    />
                  )
                ) : (
                  <div className="w-20 h-20 rounded-md bg-gray-900 bg-opacity-70 flex items-center justify-center text-white text-sm font-semibold">
                    Video Dosyası
                  </div>
                )}

                {index === 3 && files.length > 3 && (
                  <div className="absolute top-0 left-0 w-20 h-20 rounded-md bg-gray-900 bg-opacity-70 flex items-center justify-center text-white text-sm font-semibold">
                    +{files.length - 3} medya daha
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="text-gray-500">Bir fotoğraf veya video seçin</p>
            <p className="text-gray-400">(Aynı anda en fazla 10 medya)</p>
          </>
        )}
      </label>

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

        <p className="text-pink-500 font-semibold mb-2 text-sm">Kimler Görebilsin?</p>

        <div
          className="relative flex w-full rounded-full bg-gray-800 text-sm font-medium text-white overflow-hidden cursor-pointer"
          onClick={() => setVisibility(visibility === "public" ? "private" : "public")}
        >
          <div
            className={`absolute left-1 w-[49%] rounded-full bg-white transition-transform duration-300 h-5/6 top-1/2 -translate-y-1/2 ${
              visibility === "public" ? "translate-x-full" : "translate-x-0"
            }`}
          ></div>

          <div className="w-1/2 text-center py-2 z-10">
            <span className={visibility === "private" ? "text-gray-900" : "text-white"}>
              Düğün Sahipleri
            </span>
          </div>

          <div className="w-1/2 text-center py-2 z-10">
            <span className={visibility === "public" ? "text-gray-900" : "text-white"}>
              Herkese Açık
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleUpload}
        disabled={uploading}
        className={`mt-6 w-full py-3 rounded-lg text-white font-semibold transition ${
          uploading ? "bg-gray-400 cursor-not-allowed" : "bg-pink-500 hover:bg-pink-600"
        }`}
      >
        {uploading ? "Yükleniyor..." : "Yükle"}
      </button>
    </div>
  );
}
