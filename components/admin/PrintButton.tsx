"use client";
export function PrintButton() {
  return <button className="btn btn-primary btn-calm min-h-11 px-5 text-sm" onClick={() => window.print()}>Print</button>;
}
