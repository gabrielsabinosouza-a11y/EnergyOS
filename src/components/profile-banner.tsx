"use client";

interface ProfileBannerProps {
  imageUrl?: string | null;
  alt?: string;
  children?: React.ReactNode;
}

export function ProfileBanner({ imageUrl, alt = "Banner do perfil", children }: ProfileBannerProps) {
  return (
    <div className="isolate relative aspect-[3/1] w-full overflow-hidden bg-gradient-to-br from-[#24344a] to-[#0e151f]">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt}
          draggable={false}
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#24344a] to-[#0e151f]" />
      )}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      {children && (
        <div className="pointer-events-none absolute inset-0 z-10">
          {children}
        </div>
      )}
    </div>
  );
}