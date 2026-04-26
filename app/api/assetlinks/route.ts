import { NextResponse } from "next/server";

// Digital Asset Links — requerido para TWA sin barra de navegador
// Configura TWA_SHA256_CERT_FINGERPRINT en Vercel con el fingerprint de tu APK
// Obtén el fingerprint desde PWABuilder al generar la APK, o con:
//   keytool -list -v -keystore release.keystore -alias release

export async function GET() {
  const fingerprint = process.env.TWA_SHA256_CERT_FINGERPRINT;

  // Si no hay fingerprint configurado, devolver array vacío (TWA funciona pero con barra del browser)
  if (!fingerprint) {
    return NextResponse.json([], {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const assetlinks = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.wilduit.wamanager",
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ];

  return NextResponse.json(assetlinks, {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
