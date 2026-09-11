'use client';

import { linkWhatsapp } from '@/lib/whatsapp';

export default function WhatsappBoton({
  telefono,
  size = 18,
}: {
  telefono: string | null | undefined;
  size?: number;
}) {
  const link = linkWhatsapp(telefono);
  if (!link) return null;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="Abrir conversación de WhatsApp"
      className="inline-flex items-center justify-center rounded-full bg-green-500 hover:bg-green-600 text-white shrink-0"
      style={{ width: size + 8, height: size + 8 }}
    >
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
        <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20Zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.6.1s-.7.8-.9 1c-.2.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.2-.4.2-.4.6-1.2.1-.2 0-.4 0-.5L9 7.9c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.2-.9.9-.9 2.2s1 2.6 1.1 2.8c.1.2 2 3 4.7 4.2.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.6-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.2-.4-.3Z" />
      </svg>
    </a>
  );
}
