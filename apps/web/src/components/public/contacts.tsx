import {
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  type LucideIcon,
} from "lucide-react";
import type { PublicPageSettings } from "@buffet/shared";
import { cn } from "@/lib/utils";

export interface ContactLink {
  key: string;
  label: string;
  /** Ausente em canais que não são clicáveis (cidade, telefone fixo). */
  href?: string;
  icon: LucideIcon;
}

/**
 * Canais que o buffet escolheu divulgar (RF27), na ordem em que aparecem.
 * Só a lista mora aqui — cada template desenha do seu jeito.
 */
export function contactLinks(settings: PublicPageSettings): ContactLink[] {
  const links: ContactLink[] = [];
  if (settings.whatsapp) {
    links.push({
      key: "whatsapp",
      label: settings.whatsapp,
      href: whatsappUrl(settings.whatsapp),
      icon: MessageCircle,
    });
  }
  if (settings.phone) {
    links.push({ key: "phone", label: settings.phone, icon: Phone });
  }
  if (settings.email) {
    links.push({
      key: "email",
      label: settings.email,
      href: `mailto:${settings.email}`,
      icon: Mail,
    });
  }
  if (settings.instagram) {
    links.push({
      key: "instagram",
      label: `@${settings.instagram}`,
      href: `https://instagram.com/${settings.instagram}`,
      icon: Instagram,
    });
  }
  if (settings.city) {
    links.push({ key: "city", label: settings.city, icon: MapPin });
  }
  return links;
}

/**
 * Rodapé de contatos com ícone — usado por Vitrine e Direto. O Elegante desenha
 * o seu próprio, só com tipografia.
 */
export function ContactFooter({
  settings,
  className,
}: {
  settings: PublicPageSettings;
  className?: string;
}) {
  const links = contactLinks(settings);
  if (links.length === 0) return null;

  return (
    <footer
      className={cn(
        "flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-sm text-muted-foreground",
        className
      )}
    >
      {links.map(({ key, label, href, icon: Icon }) => {
        const content = (
          <>
            <Icon aria-hidden className="size-4" />
            {label}
          </>
        );
        return href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {content}
          </a>
        ) : (
          <span key={key} className="inline-flex items-center gap-2">
            {content}
          </span>
        );
      })}
    </footer>
  );
}

/**
 * Link de conversa no WhatsApp. `wa.me` exige só dígitos; o Brasil entra com o
 * DDI 55 quando ele falta. Com `message`, a conversa já abre escrita.
 */
export function whatsappUrl(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length <= 11 ? `55${digits}` : digits;
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${withCountry}${query}`;
}
