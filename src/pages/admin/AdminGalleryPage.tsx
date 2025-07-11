import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import {
  collection,
  query,
  orderBy,
  getDocs,
  getDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import LightGallery from "lightgallery/react";
import lgVideo from "lightgallery/plugins/video";

// import styles
import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";

// If you want you can use SCSS instead of css
import "lightgallery/scss/lightgallery.scss";
import "lightgallery/scss/lg-zoom.scss";
import "lightgallery/css/lg-video.css";
// import plugins if you need
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";
import Swal from "sweetalert2";

type ImageMedia = {
  id: string;
  src: string;
  width: number;
  height: number;
  type: "image";
  senderName?: string;
  visibility?: string;
};

type VideoMedia = {
  id: string;
  src: string;
  thumbnail: string;
  width: number;
  height: number;
  type: "video";
  senderName?: string;
  visibility?: string;
};

type MediaItem = ImageMedia | VideoMedia;
export default function AdminGalleryPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [adminInfo, setAdminInfo] = useState<{
    adminId: string;
    adminPass: string;
  }>({
    adminId: "",
    adminPass: "",
  });
  const [isAuthorized, setIsAuthorized] = useState(false);
  const onInit = (detail: any) => {
    const lgInstance = detail.instance;

    const toolbar = document.querySelector(".lg-toolbar");
    if (toolbar && !document.querySelector(".lg-share-btn")) {
      const shareBtn = document.createElement("button");
      shareBtn.innerHTML = "Paylaş";
      shareBtn.className = "lg-share-btn lg-icon";
      shareBtn.style.marginLeft = "10px";
      shareBtn.style.marginRight = "10px";
      shareBtn.onclick = () => {
        const currentIndex = lgInstance.index;
        const currentItem = lgInstance.galleryItems[currentIndex];
        const shareData = {
          title: "Galeri Paylaşımı",
          url: currentItem.src,
        };

        if (navigator.share) {
          navigator
            .share(shareData)
            .catch((err) => console.log("Paylaşma başarısız:", err));
        } else {
          alert(
            "Tarayıcınız paylaşma özelliğini desteklemiyor. URL kopyalandı."
          );
          navigator.clipboard.writeText(currentItem.src);
        }
      };

      toolbar.appendChild(shareBtn);
    }
  };
  const loadImageSize = (
    url: string
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.src = url;
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
    });
  };

  useEffect(() => {
    if (!eventId) return; // eventId kesinlikle olmalı
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

    const fetchMedia = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "events", eventId, "media"),
          orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        const promises = snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          if (!data.url || !data.type) return null;

          return data.type === "image"
            ? {
                id: docSnap.id,
                src: data.url,
                type: "image" as const,
                width: (await loadImageSize(data.url)).width,
                height: (await loadImageSize(data.url)).height,
                senderName: data.senderName,
                visibility: data.visibility,
              }
            : data.type === "video" && data.thumbnail
            ? {
                id: docSnap.id,
                src: data.url,
                thumbnail: data.thumbnail,
                type: "video" as const,
                width: 1280,
                height: 720,
                senderName: data.senderName,
                visibility: data.visibility,
              }
            : null;
        });
        const isMediaItem = (item: any): item is MediaItem => {
          return (
            item !== null &&
            typeof item === "object" &&
            typeof item.src === "string" &&
            (item.type === "image" ||
              (item.type === "video" && typeof item.thumbnail === "string")) &&
            typeof item.width === "number" &&
            typeof item.height === "number"
          );
        };
        const rawResults = await Promise.all(promises);
        const filteredResults = rawResults.filter(isMediaItem);

        setMediaList(filteredResults as MediaItem[]);
      } catch (e) {
        console.error("Media fetch error:", e);
      }
      setLoading(false);
    };

    fetchEvent();
    fetchMedia();
  }, [eventId]);
  const makePrivate = async (mediaId: string, currentVisibility: string) => {
    if (!eventId) return;
    const newVisibility = currentVisibility === "public" ? "private" : "public";
    try {
      const mediaDocRef = doc(db, "events", eventId, "media", mediaId);
      await updateDoc(mediaDocRef, {
        visibility: currentVisibility === "public" ? "private" : "public",
      });

      // Durumu güncellemek için mediaList'i filtrele veya güncelle
      setMediaList((prev) =>
        prev.map((item) =>
          item.id === mediaId
            ? {
                ...item,
                visibility:
                  currentVisibility === "public" ? "private" : "public",
              }
            : item
        )
      );

      Swal.fire({
        title: "Başarılı!",
        text:
          newVisibility === "private"
            ? "Medya gizlendi (private yapıldı)."
            : "Medya artık herkese açık (public yapıldı).",
        icon: "success",
        confirmButtonText: "Tamam",
      });
    } catch (error) {
      console.error("Güncelleme başarısız:", error);
      Swal.fire({
        title: "Hata!",
        text:
          newVisibility === "private"
            ? "Medya gizlenirken hata oluştu."
            : "Medya herkese açık yapılırken hata oluştu.",
        icon: "error",
        confirmButtonText: "Tamam",
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
    <div style={{ padding: 20 }}>
      <h1
        className="text-4xl text-center mb-8 text-black"
        style={{ fontFamily: "'Ms Madi', cursive" }}
      >
        {eventName}
      </h1>
      <h1 className="text-3xl font-bold text-center text-pink-600 mb-6">
        Galeri
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <button
          onClick={() => navigate(`/${eventId}/adminMemory`)}
          className="w-full px-4 py-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📖 Anı Defteri
        </button>

        <button
          onClick={() => navigate(`/${eventId}/adminVoice`)}
          className="w-full px-4 py-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          🔊 Sesli Anı Defteri
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

      {loading === true && (
        <div className="flex flex-col items-center justify-center min-h-[150px]">
          <div
            className={`
      animate-spin
      rounded-full
      border-4
      border-t-4
      border-pink-500
      border-t-transparent
      w-8 h-8
    `}
          />
          <p className="text-2xl text-center mt-4 text-black">Yükleniyor</p>
        </div>
      )}

      {mediaList.length === 0 && loading === false && (
        <p className="text-2xl text-center mb-8 text-black">
          Henüz herkese açık bir Fotoğraf&Video Yüklenmemiş.
        </p>
      )}
      <LightGallery
        onInit={onInit}
        speed={500}
        plugins={[lgThumbnail, lgZoom, lgVideo]}
        elementClassNames="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
      >
        {mediaList.map((media) => (
          <div key={media.id} className="relative rounded-lg overflow-hidden">
            {media.visibility === "public" && (
              <button
                onClick={(e) => {
                  e.preventDefault(); // link açılmasını engelle
                  const visibility = media.visibility ?? "public";
                  makePrivate(media.id, visibility);
                }}
                className="absolute top-2 right-2 z-20 bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition"
                title="Medya Gizle"
              >
                Gizle
              </button>
            )}
            {media.visibility === "private" && (
              <button
                onClick={(e) => {
                  e.preventDefault(); // link açılmasını engelle
                  const visibility = media.visibility ?? "public";
                  makePrivate(media.id, visibility);
                }}
                className="absolute top-2 right-2 z-20 bg-red-600 text-white px-2 py-1 rounded text-xs hover:bg-red-700 transition"
                title="Medya Gizle"
              >
                Göster
              </button>
            )}

            {media.type === "image" ? (
              <a
                href={media.src}
                data-sub-html={`<h4>Gönderen: ${
                  media.senderName || "Anonim"
                }</h4>`}
                className="block w-full aspect-square cursor-pointer"
              >
                <img
                  src={media.src}
                  alt=""
                  className="w-full h-full object-cover rounded-lg"
                />
              </a>
            ) : (
              <a
                data-lg-size="1280-720"
                data-sub-html={`<h4>Gönderen: ${
                  media.senderName || "Anonim"
                }</h4>`}
                data-video={JSON.stringify({
                  source: [
                    {
                      src: media.src,
                      type: "video/mp4",
                    },
                  ],
                  attributes: {
                    preload: false,
                    controls: true,
                  },
                })}
                className="block w-full aspect-square cursor-pointer"
              >
                <img
                  src={media.thumbnail}
                  alt="video"
                  className="w-full h-full object-cover rounded-lg"
                />
              </a>
            )}
          </div>
        ))}
      </LightGallery>
    </div>
  );
}
