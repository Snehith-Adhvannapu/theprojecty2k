import { Fragment } from "react";

/** *Words between stars* get the accent style; everything else is plain (escaped by React). */
export function Rich({ text, as = "span" }: { text: string; as?: "span" | "em" }) {
  const Tag = as;
  return (
    <>
      {text.split("*").map((part, i) =>
        i % 2 === 1 ? <Tag key={i} className={as === "span" ? "text-crimson" : undefined}>{part}</Tag> : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}
