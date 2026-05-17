"use client"

import Image from "next/image"

const FALLBACK_LOGO = "/logo-rooms.png"

export function PublicNavLogo({
  logoUrl,
  alt,
}: {
  logoUrl?: string
  alt: string
}) {
  const tenantLogo = logoUrl?.trim() ? logoUrl : FALLBACK_LOGO

  return (
    <Image
      src={tenantLogo}
      alt={alt}
      fill
      className="object-contain scale-110"
      onError={(event) => {
        if (!event.currentTarget.src.endsWith(FALLBACK_LOGO)) {
          event.currentTarget.src = FALLBACK_LOGO
        }
      }}
      priority
      unoptimized
    />
  )
}
