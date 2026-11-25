import { getImageProps } from "next/image";
import type { GuideImage } from "@/lib/release-guides";

type Props = {
  image: GuideImage;
  compact?: boolean;
  eager?: boolean;
  highPriority?: boolean;
};

export function CardImage({ image, compact, eager, highPriority }: Props) {
  const sizes = compact
    ? "(max-width: 980px) calc(50vw - 20px), (max-width: 1024px) 24vw, min(265px, calc(25vw - 80px))"
    : "(max-width: 650px) calc(100vw - 26px), (max-width: 1024px) 48vw, min(530px, calc(50vw - 154px))";
  const { props } = getImageProps({
    src: image.src,
    alt: compact ? "" : image.alt,
    width: image.width,
    height: image.height,
    sizes,
    loading: eager ? "eager" : "lazy",
    fetchPriority: highPriority ? "high" : undefined
  });

  return <div className="guide-feature-image"><img {...props} /></div>;
}
