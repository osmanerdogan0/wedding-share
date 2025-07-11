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
  src: string;
  width: number;
  height: number;
  type: "image";
  senderName?: string;
};

type VideoMedia = {
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
    if (!eventId || !hasMore || loading) return;
    setLoading(true);

    try {
      let q;
      if (lastVisible) {
        q = query(
          collection(db, "events", eventId, "media"),
          where("visibility", "==", "public"),
          orderBy("createdAt", "desc"),
          startAfter(lastVisible),
          limit(PAGE_SIZE)
        );
      } else {
        q = query(
          collection(db, "events", eventId, "media"),
          where("visibility", "==", "public"),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE)
        );
      }

      const snapshot = await getDocs(q);

      const items: MediaItem[] = await Promise.all(
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          if (!data.url || !data.type) return null;

          if (data.type === "image") {
            try {
              const size = await loadImageSize(data.url);
              return {
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

      const filtered = items.filter((i): i is MediaItem => i !== null);
      setMediaList((prev) => [...prev, ...filtered]);

      if (snapshot.docs.length < PAGE_SIZE) setHasMore(false);
      if (snapshot.docs.length > 0)
        setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
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
      shareBtn.onclick = () => {
        const currentIndex = lgInstance.index;
        const currentItem = lgInstance.galleryItems[currentIndex];
        const shareData = {
          title: "Galeri Paylaşımı",
          url: currentItem.src,
        };
        if (navigator.share) {
          navigator.share(shareData).catch(console.error);
        } else {
          navigator.clipboard.writeText(currentItem.src);
          alert("Paylaşım desteklenmiyor. URL kopyalandı.");
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
              key={index}
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
              key={index}
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
