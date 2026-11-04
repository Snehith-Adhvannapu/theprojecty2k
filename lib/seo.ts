// Search-engine facts in one place. Only facts that are already in config/event.ts: nothing invented.
import { appUrl, LIVE_URL } from "@/lib/app-url";
import { eventConfig as e } from "@/config/event";

/** The one address search engines should treat as the site, whatever host served the request. */
export const SITE_URL = LIVE_URL;

/** False on test/staging hosts (aws.*, localhost) so they never compete with the real site in search. */
export function isIndexableHost(): boolean {
  try {
    const h = new URL(appUrl()).hostname;
    return !/^(aws|test|staging|preview)\./.test(h) && h !== "localhost" && h !== "127.0.0.1";
  } catch {
    return true;
  }
}

export const SEO_TITLE = "Project Y2K: The Matrix | Hyderabad Theatre Rave 15 Nov 2026";
export const SEO_DESCRIPTION =
  `The Matrix is Hyderabad's first theatre rave: ${e.dateLabel} at ${e.venue.name}. Electrifying beats, immersive visuals and big-screen sound. Get your pass.`;
export const SEO_KEYWORDS = [
  "Hyderabad theatre rave", "theatre rave Hyderabad", "Project Y2K", "Project Y2K The Matrix", "The Matrix party Hyderabad",
  "Prasad's IMAX party", "Hyderabad party 15 November 2026", "Hyderabad music event", "Y2K party Hyderabad",
];

const instagramUrl = () => `https://www.instagram.com/${e.organiser.instagram.replace(/^@/, "")}`;

/** schema.org graph: the Event (so it can appear as an event result), the organiser and the site. */
export function structuredData(prices: { low: number; high: number; count: number } | null) {
  const ogImage = `${SITE_URL}/images/og-tickets.jpg`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: e.name,
        alternateName: ["Project Y2K The Matrix", "Project.Y2K", "Y2K Hyderabad"],
        inLanguage: "en-IN",
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organiser`,
        name: e.name,
        url: SITE_URL,
        logo: `${SITE_URL}/images/y2k26-logo.png`,
        sameAs: [instagramUrl()],
      },
      {
        "@type": "Event",
        "@id": `${SITE_URL}/#event`,
        name: `${e.name}: The Matrix`,
        description: "Hyderabad's first theatre rave: music, visuals and sound on the big screen at Prasad's IMAX.",
        startDate: `${e.date}T12:00:00+05:30`,
        endDate: `${e.date}T17:00:00+05:30`,
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        image: [ogImage, `${SITE_URL}/images/hero-poster.webp`],
        url: SITE_URL,
        isAccessibleForFree: false,
        inLanguage: "en-IN",
        location: {
          "@type": "Place",
          name: e.venue.name,
          hasMap: e.venue.mapUrl,
          address: { "@type": "PostalAddress", addressLocality: "Hyderabad", addressRegion: "Telangana", addressCountry: "IN" },
        },
        organizer: { "@id": `${SITE_URL}/#organiser` },
        ...(prices && prices.count > 0
          ? {
              offers: {
                "@type": "AggregateOffer",
                url: `${SITE_URL}/#passes`,
                priceCurrency: "INR",
                lowPrice: String(prices.low / 100),
                highPrice: String(prices.high / 100),
                offerCount: prices.count,
                availability: "https://schema.org/InStock",
              },
            }
          : {}),
      },
    ],
  };
}
