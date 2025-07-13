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
  deleteDoc,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { storage } from "../../firebaseConfig";
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
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      const shareBtn = document.createElement("button");
      shareBtn.innerHTML = isIOS ? "İndir" : "Paylaş";
      shareBtn.className = "lg-share-btn lg-icon";
      shareBtn.style.marginLeft = "10px";
      shareBtn.style.marginRight = "10px";

      shareBtn.onclick = async () => {
        const currentIndex = lgInstance.index;
        const currentItem = lgInstance.galleryItems[currentIndex];

        if (isIOS) {
          // iOS: yalnızca yeni sekmede açma önerilir
          const newWindow = window.open(currentItem.src, "_blank");
          if (!newWindow) {
            alert(
              "Lütfen tarayıcı ayarlarından açılır pencere engelini kaldırın."
            );
          } else {
            alert("Görsel açıldı. Uzun basılı tutarak kaydedebilirsiniz.");
          }
          return;
        }

        // Android ve diğer tarayıcılarda native paylaşımı dene
        try {
          const response = await fetch(currentItem.src);
          const blob = await response.blob();
          const file = new File([blob], "photo.jpg", { type: blob.type });

          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: "Galeri Paylaşımı",
              files: [file],
            });
          } else {
            navigator.clipboard.writeText(currentItem.src);
            alert("Paylaşım desteklenmiyor. URL kopyalandı.");
          }
        } catch (err) {
          console.error("Paylaşım hatası:", err);
          alert("İşlem sırasında bir hata oluştu.");
        }
      };

      toolbar.appendChild(shareBtn);
    }
  };

  const onBeforeSlide = (detail: any) => {
    const { index, prevIndex } = detail;
    console.log("Slide changing from", prevIndex, "to", index);

    // Geçerli item'ı kontrol et
    const currentItem = mediaList[index];
    if (currentItem) {
      console.log("Current item:", currentItem);
      console.log("Image URL:", currentItem.src);
    }
  };

  const onAfterSlide = (detail: any) => {
    const { index } = detail;
    console.log("Slide changed to", index);

    // Resim yükleme durumunu kontrol et
    const imgElement = document.querySelector(".lg-current .lg-image");
    if (imgElement) {
      imgElement.addEventListener("error", (e) => {
        console.error("Image failed to load:", e);
      });
      imgElement.addEventListener("load", () => {
        console.log("Image loaded successfully");
      });
    }
  };

  const fixFirebaseUrl = (url: string): string => {
    // Firebase Storage URL'lerini CORS sorunlarını önlemek için düzenle
    if (url.includes("firebasestorage.googleapis.com")) {
      // URL'ye &token= parametresi ekleyerek CORS sorununu çöz
      if (!url.includes("&token=") && !url.includes("?token=")) {
        const separator = url.includes("?") ? "&" : "?";
        return `${url}${separator}alt=media`;
      }
    }
    return url;
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

  const extractStoragePath = (url: string): string => {
    const decodedUrl = decodeURIComponent(url);
    const match = decodedUrl.match(/\/o\/(.*?)\?/); // "/o/FILE_PATH?"
    if (match && match[1]) {
      return match[1];
    } else {
      throw new Error("Storage path could not be extracted from URL.");
    }
  };

  const deleteMedia = async (media: MediaItem) => {
    if (!eventId) return;

    const result = await Swal.fire({
      title: "Emin misiniz?",
      text: "Bu medya kalıcı olarak silinecek!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Evet, sil",
      cancelButtonText: "İptal",
    });

    if (!result.isConfirmed) return;

    try {
      // Firestore'dan sil
      const mediaDocRef = doc(db, "events", eventId, "media", media.id);
      // await updateDoc(mediaDocRef, { visibility: "deleting" }); // geçici koruma

      const storagePath = extractStoragePath(media.src);
      const fileRef = ref(storage, storagePath);
      await deleteObject(fileRef);
      await deleteDoc(mediaDocRef);

      // Ekrandan kaldır
      setMediaList((prev) => prev.filter((item) => item.id !== media.id));

      Swal.fire({
        title: "Silindi!",
        text: "Medya başarıyla silindi.",
        icon: "success",
        confirmButtonText: "Tamam",
      });
    } catch (error) {
      console.error("Medya silme hatası:", error);
      Swal.fire({
        title: "Hata!",
        text: "Medya silinirken bir sorun oluştu.",
        icon: "error",
        confirmButtonText: "Tamam",
      });
    }
  };

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
        onBeforeSlide={onBeforeSlide}
        onAfterSlide={onAfterSlide}
        speed={500}
        plugins={[lgThumbnail, lgZoom, lgVideo]}
        elementClassNames="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
        selector=".lg-item"
        download={false}
        actualSize={false}
        showZoomInOutIcons={true}
        allowMediaOverlap={true}
        closable={true}
        showCloseIcon={true}
        mousewheel={true}
        mobileSettings={{
          controls: true,
          showCloseIcon: true,
          download: false,
          rotate: false,
        }}
      >
        {mediaList.map((media) => (
          <div key={media.id} className="relative rounded-lg overflow-hidden">
            {/* Butonlar için container */}
            <div className="absolute top-2 right-2 z-20 flex flex-col gap-1 items-end">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  const visibility = media.visibility ?? "public";
                  makePrivate(media.id, visibility);
                }}
                className="bg-yellow-600 text-white px-2 py-1 rounded text-xs hover:bg-yellow-700 transition"
                title={
                  media.visibility === "public" ? "Medya Gizle" : "Medya Göster"
                }
              >
                {media.visibility === "public" ? "Gizle" : "Göster"}
              </button>

              <button
                onClick={(e) => {
                  e.preventDefault();
                  deleteMedia(media);
                }}
                className="bg-red-700 text-white px-2 py-1 rounded text-xs hover:bg-red-800 transition"
                title="Medya Sil"
              >
                Sil
              </button>
            </div>

            {media.type === "image" ? (
              <a
                className="lg-item block w-full aspect-square cursor-pointer"
                data-src={fixFirebaseUrl(media.src)}
                data-sub-html={`<h4>Gönderen: ${
                  media.senderName || "Anonim"
                }</h4>`}
              >
                <img
                  src={media.src}
                  alt=""
                  className="w-full h-full object-cover rounded-lg"
                  loading="lazy"
                />
              </a>
            ) : (
              <a
                className="lg-item block w-full aspect-square cursor-pointer"
                data-src={fixFirebaseUrl(media.src)}
                data-video={`{"source": [{"src":"${fixFirebaseUrl(
                  media.src
                )}", "type":"video/mp4"}], "attributes": {"preload": false, "controls": true}}`}
                data-sub-html={`<h4>Gönderen: ${
                  media.senderName || "Anonim"
                }</h4>`}
              >
                <img
                  src={media.thumbnail}
                  alt="video"
                  className="w-full h-full object-cover rounded-lg"
                  loading="lazy"
                />
              </a>
            )}
          </div>
        ))}
      </LightGallery>
    </div>
  );
}
