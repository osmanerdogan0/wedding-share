// GalleryItem.tsx
import { useInView } from "react-intersection-observer";
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
type Props = {
  media: MediaItem;
  index: number;
};

export default function GalleryItem({ media, index }: Props) {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.1,
  });

  const sender = media.senderName || "Anonim";

  if (media.type === "image") {
    return (
      <a
        key={index}
        href={media.src}
        data-thumb={media.src}
        data-sub-html={`<h4>Gönderen: ${sender}</h4>`}
        className="block w-full aspect-square overflow-hidden rounded-lg"
        ref={ref}
      >
        {inView ? (
          <img
            src={media.src}
            alt=""
            className="w-full h-full object-cover rounded-lg cursor-pointer"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg" />
        )}
      </a>
    );
  }

  return (
    <a
      key={index}
      data-lg-size="1280-720"
      data-thumb={media.thumbnail}
      data-sub-html={`<h4>Gönderen: ${sender}</h4>`}
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
      className="block w-full aspect-square overflow-hidden rounded-lg"
      ref={ref}
    >
      {inView ? (
        <img
          src={media.thumbnail}
          alt="video"
          className="w-full h-full object-cover rounded-lg cursor-pointer"
        />
      ) : (
        <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg" />
      )}
    </a>
  );
}
