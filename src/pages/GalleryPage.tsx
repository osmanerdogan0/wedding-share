import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../firebaseConfig";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  doc,
  limit,
  startAfter,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import LightGallery from "lightgallery/react";
import lgVideo from "lightgallery/plugins/video";
import lgThumbnail from "lightgallery/plugins/thumbnail";
import lgZoom from "lightgallery/plugins/zoom";

import "lightgallery/css/lightgallery.css";
import "lightgallery/css/lg-zoom.css";
import "lightgallery/css/lg-thumbnail.css";
import "lightgallery/css/lg-video.css";

type ImageMedia = {
  id: string; // Add this
  src: string;
  width: number;
  height: number;
  type: "image";
  senderName?: string;
};

type VideoMedia = {
  id: string; // Add this
  src: string;
  thumbnail: string;
  width: number;
  height: number;
  type: "video";
  senderName?: string;
};

type MediaItem = ImageMedia | VideoMedia;

export default function GalleryPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(
    null
  );
  const navigate = useNavigate();

  const PAGE_SIZE = 4;

  const loadImageSize = (
    url: string
  ): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
    });
  };

  const fetchEvent = async () => {
    if (!eventId) return;
    try {
      const docRef = doc(db, "events", eventId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setEventName(docSnap.data().eventName || "");
      }
    } catch (error) {
      console.error("Event verisi alınırken hata:", error);
    }
  };

  const fetchMediaPage = async () => {
    console.log("Medya Çek");
    // EventId yoksa, daha fazla veri yoksa veya yükleme devam ediyorsa durdur.
    if (!eventId || !hasMore || loading) return;
    setLoading(true);

    try {
      // 'q' değişkenini tanımlayın.
      let q;

      // Eğer lastVisible (son görünen doküman) varsa, kaldığı yerden devam et.
      if (lastVisible) {
        q = query(
          collection(db, "events", eventId, "media"),
          where("visibility", "==", "public"),
          orderBy("createdAt", "desc"),
          startAfter(lastVisible),
          limit(PAGE_SIZE)
        );
      } else {
        // İlk yükleme, baştan başla.
        q = query(
          collection(db, "events", eventId, "media"),
          where("visibility", "==", "public"),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE)
        );
      }

      // 'q' değişkeninin tanımlı olduğundan emin olun. (Normalde bu if/else bloğu ile tanımlanmış olmalı)
      if (!q) {
        console.error("Sorgu (q) tanımlanamadı.");
        setLoading(false);
        return;
      }

      // Verileri Firestore'dan çek.
      const snapshot = await getDocs(q);

      // Verileri işleyerek MediaItem tipine dönüştür.
      const items: MediaItem[] = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          const id = docSnap.id; // Doküman ID'sini al.
          if (!data.url || !data.type) return null;

          if (data.type === "image") {
            try {
              const size = await loadImageSize(data.url);
              return {
                id, // ID'yi ekleyin
                src: data.url,
                type: "image" as const,
                width: size.width,
                height: size.height,
                senderName: data.senderName,
              };
            } catch {
              return null;
            }
          } else if (data.type === "video" && data.thumbnail) {
            return {
              id, // ID'yi ekleyin
              src: data.url,
              thumbnail: data.thumbnail,
              type: "video" as const,
              width: 1280,
              height: 720,
              senderName: data.senderName,
            };
          }

          return null;
        })
      );

      // Null değerleri kaldır.
      const filtered = items.filter((i): i is MediaItem => i !== null);

      // Mevcut mediaList içindeki ID'lerin bir kümesini oluştur.
      const existingIds = new Set(mediaList.map((item) => item.id));

      // Sadece mevcut listede olmayan benzersiz öğeleri filtrele.
      // Sadece mevcut listede olmayan benzersiz öğeleri filtrele.

      // Benzersiz yeni öğeleri mevcut listeye ekle.
      setMediaList((prev) => {
        // Prev (önceki) state'i kullanarak mevcut ID'leri tekrar kontrol edin
        const prevIds = new Set(prev.map((item) => item.id));

        // Sadece daha önce listelenmemiş yeni öğeleri ekleyin
        const trulyUniqueItems = filtered.filter(
          (item) => !prevIds.has(item.id)
        );

        // Konsolda kaç öğe eklendiğini kontrol edebilirsiniz
        // console.log("Adding unique items:", trulyUniqueItems.length);

        return [...prev, ...trulyUniqueItems];
      });
      // Eğer çekilen doküman sayısı PAGE_SIZE'dan az ise, daha fazla veri yok demektir.
      if (snapshot.docs.length < PAGE_SIZE) {
        setHasMore(false);
      }

      // Bir sonraki sayfa için son görünen dokümanı ayarla.
      if (snapshot.docs.length > 0) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      }
    } catch (error) {
      console.error("Media fetch error:", error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    setMediaList([]);
    setLastVisible(null);
    setHasMore(true);
    fetchMediaPage();
  }, [eventId]);

  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 300 &&
        !loading &&
        hasMore
      ) {
        fetchMediaPage();
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [loading, hasMore, lastVisible]);

  const onInit = (detail: any) => {
    const lgInstance = detail.instance;
    const toolbar = document.querySelector(".lg-toolbar");

    if (toolbar && !document.querySelector(".lg-share-btn")) {
      const shareBtn = document.createElement("button");
      shareBtn.innerHTML = "Paylaş";
      shareBtn.className = "lg-share-btn lg-icon";
      shareBtn.style.margin = "0 10px";

      shareBtn.onclick = async () => {
        const currentIndex = lgInstance.index;
        const currentItem = lgInstance.galleryItems[currentIndex];

        if (navigator.share) {
          try {
            // 1. Görseli çekme girişimi
            const response = await fetch(currentItem.src);

            // Eğer HTTP hatası varsa (örneğin 404, 500)
            if (!response.ok) {
              throw new Error(`HTTP hatası: ${response.status}`);
            }

            const blob = await response.blob();

            // Dosya ismini belirleme
            const urlParts = currentItem.src.split("/");
            const fileName =
              urlParts[urlParts.length - 1] || "gallery_image.jpg";

            // File nesnesi oluşturma
            const file = new File([blob], fileName, { type: blob.type });

            // 2. Native dosya paylaşımını deneme
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: "Galeri Paylaşımı",
                text: "Bu fotoğrafı galeri uygulamasından paylaşıyorum.",
              });
            } else {
              // Dosya paylaşımı desteklenmiyorsa URL paylaşımı (fallback)
              await navigator.share({
                title: "Galeri Paylaşımı",
                url: currentItem.src,
              });
            }
          } catch (error) {
            console.error("Paylaşım hatası (Ağ veya CORS):", error);

            // Hata durumunda URL paylaşımı ile devam etmeyi dene
            if (navigator.share) {
              try {
                await navigator.share({
                  title: "Galeri Paylaşımı",
                  url: currentItem.src,
                });
              } catch (urlShareError) {
                console.error(
                  "URL paylaşımı da başarısız oldu:",
                  urlShareError
                );
                const newWindow = window.open(currentItem.src, "_blank");

                if (!newWindow) {
                  alert(
                    "Açılır pencere engellendi. Lütfen tarayıcı ayarlarını kontrol edin."
                  );
                } else {
                  // iOS veya tarayıcı kısıtlamaları nedeniyle indirme başlamazsa
                  alert(
                    "Görsel yeni sekmede açıldı. Görselin üzerine uzun basarak kaydedebilir veya indirebilirsiniz."
                  );
                }
              }
            } else {
              const newWindow = window.open(currentItem.src, "_blank");

              if (!newWindow) {
                alert(
                  "Açılır pencere engellendi. Lütfen tarayıcı ayarlarını kontrol edin."
                );
              } else {
                // iOS veya tarayıcı kısıtlamaları nedeniyle indirme başlamazsa
                alert(
                  "Görsel yeni sekmede açıldı. Görselin üzerine uzun basarak kaydedebilir veya indirebilirsiniz."
                );
              }
            }
          }
        } else {
          const newWindow = window.open(currentItem.src, "_blank");

          if (!newWindow) {
            alert(
              "Açılır pencere engellendi. Lütfen tarayıcı ayarlarını kontrol edin."
            );
          } else {
            // iOS veya tarayıcı kısıtlamaları nedeniyle indirme başlamazsa
            alert(
              "Görsel yeni sekmede açıldı. Görselin üzerine uzun basarak kaydedebilir veya indirebilirsiniz."
            );
          }
        }
      };

      toolbar.appendChild(shareBtn);
    }
  };

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
          onClick={() => navigate(`/${eventId}`)}
          className="w-full px-4 py-4 bg-pink-500 hover:bg-pink-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📸 Fotoğraf&Video Yükle
        </button>
        <button
          onClick={() => navigate(`/${eventId}/memoryUpload`)}
          className="w-full px-4 py-4 bg-rose-500 hover:bg-rose-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          📖 Anı Defteri
        </button>
        <button
          onClick={() => navigate(`/${eventId}/voiceUpload`)}
          className="w-full px-4 py-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-xl shadow-md transition-all"
        >
          🔊 Sesli Anı Defteri
        </button>
      </div>

      {mediaList.length === 0 && !loading && (
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
        {mediaList.map((media, index) =>
          media.type === "image" ? (
            <a
              key={media.id}
              href={media.src}
              data-sub-html={`<h4>Gönderen: ${
                media.senderName || "Anonim"
              }</h4>`}
              className="block w-full aspect-square overflow-hidden rounded-lg"
            >
              <img
                src={media.src}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover rounded-lg cursor-pointer"
              />
            </a>
          ) : (
            <a
              key={media.id}
              data-lg-size="1280-720"
              data-sub-html={`<h4>Gönderen: ${
                media.senderName || "Anonim"
              }</h4>`}
              data-video={JSON.stringify({
                source: [{ src: media.src, type: "video/mp4" }],
                attributes: { preload: false, controls: true },
              })}
              className="block w-full aspect-square overflow-hidden rounded-lg"
            >
              <img
                src={media.thumbnail}
                alt="video"
                loading="lazy"
                className="w-full h-full object-cover rounded-lg cursor-pointer"
              />
            </a>
          )
        )}
      </LightGallery>

      {loading && (
        <div className="text-center py-4 text-gray-600">Yükleniyor...</div>
      )}
      {!hasMore && (
        <div className="text-center py-4 text-gray-600">
          Tüm içerikler yüklendi.
        </div>
      )}
    </div>
  );
}
