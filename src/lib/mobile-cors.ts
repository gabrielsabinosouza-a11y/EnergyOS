function isPrivateIpv4(hostname: string): boolean {
  const octets = hostname.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function isAllowedMobileWebOrigin(
  origin: string,
  environment = process.env.NODE_ENV,
  configuredOrigins = process.env.MOBILE_WEB_ORIGINS,
): boolean {
  if (!origin) return false;

  const configured = configuredOrigins?.split(",").map((value) => value.trim()) ?? [];
  if (configured.includes(origin)) return true;
  if (environment === "production") return false;

  try {
    const url = new URL(origin);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || isPrivateIpv4(url.hostname))
    );
  } catch {
    return false;
  }
}
