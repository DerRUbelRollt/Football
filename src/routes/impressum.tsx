import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/impressum")({
  head: () => ({ meta: [{ title: "Impressum – Fußball Team Manager" }] }),
  component: ImpressumPage,
});

function ImpressumPage() {
  return (
    <div className="min-h-screen bg-pitch px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <div className="card-elevated p-6 sm:p-8 space-y-6 text-sm leading-relaxed">
          <h1 className="text-2xl font-black tracking-tight">Impressum</h1>

          <section>
            <h2 className="font-semibold mb-1">Angaben gemäß § 5 DDG</h2>
            <p>
              Max Rubel
              <br />
              Hochstraße 124
              <br />
              66115 Saarbrücken
              <br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">Kontakt</h2>
            <p>E-Mail: maxrubel8@gmail.com</p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <p>Max Rubel, Anschrift wie oben</p>
          </section>
        </div>
      </div>
    </div>
  );
}
