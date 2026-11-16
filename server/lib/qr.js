import QRCode from 'qrcode';

/** URL encoded in every ticket QR: opens the admin scanner with the code prefilled. */
export function verificationUrl(baseUrl, code) {
  return `${baseUrl}/admin/escanear?codigo=${encodeURIComponent(code)}`;
}

/** High-resolution PNG data URL. Dark ink on white keeps it readable for any camera. */
export function generateQrDataUrl(text) {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 720,
    color: { dark: '#2A0F40FF', light: '#FFFFFFFF' },
  });
}
