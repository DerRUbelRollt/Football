import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({ meta: [{ title: "Datenschutz – Fußball Team Manager" }] }),
  component: DatenschutzPage,
});

function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-pitch px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </Link>
        <div className="card-elevated p-6 sm:p-8 space-y-6 text-sm leading-relaxed">
          <h1 className="text-2xl font-black tracking-tight">Datenschutzerklärung</h1>

          <section>
            <h2 className="font-semibold mb-1">1. Verantwortlicher</h2>
            <p>
              Max Rubel
              <br />
              Hochstraße 124
              <br />
              66115 Saarbrücken
              <br />
              E-Mail: maxrubel8@gmail.com
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">2. Zweck und Umfang der Datenverarbeitung</h2>
            <p>
              Diese Anwendung dient der internen Verwaltung einer Fußballmannschaft (Trainings, Spiele,
              Anwesenheiten, Statistiken). Verarbeitet werden dabei:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Trainer-Zugangsdaten (Name, verschlüsseltes Passwort)</li>
              <li>Spielerdaten (Vor- und Nachname, eindeutige Spieler-ID, Zuordnung zu Mannschaften)</li>
              <li>Anwesenheits- und Statistikdaten zu Trainings und Spielen</li>
              <li>Technisch notwendige Sitzungsdaten (Session-Cookie zur Anmeldung)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold mb-1">3. Rechtsgrundlage</h2>
            <p>
              Die Verarbeitung erfolgt auf Grundlage der Einwilligung der Spieler (Art. 6 Abs. 1 lit. a
              DSGVO), die vor Inbetriebnahme dieser Anwendung mündlich eingeholt wird, sowie auf Grundlage
              des berechtigten Interesses an einer geordneten Vereins- und Mannschaftsorganisation
              (Art. 6 Abs. 1 lit. f DSGVO). Es werden dabei nur Namen verarbeitet, die den Spielern ohnehin
              bereits über ihre Vereinsanmeldung bekannt sind.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">4. Speicherdauer</h2>
            <p>
              Es gibt aktuell noch keine feste Löschfrist. Personenbezogene Daten werden nur so lange
              gespeichert, wie sie für den oben genannten Zweck benötigt werden, spätestens jedoch bis zum
              Austritt eines Spielers aus der Mannschaft — danach werden sie unverzüglich gelöscht.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">5. Cookies</h2>
            <p>
              Diese Anwendung setzt ausschließlich ein technisch notwendiges Sitzungs-Cookie
              (<code>tc_session</code>) zur Anmeldung. Es dient keinerlei Tracking- oder
              Werbezwecken und wird nicht an Dritte weitergegeben.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">6. Hosting</h2>
            <p>
              Diese Anwendung läuft auf einem eigenen Server (V-Server der STRATO AG) mit Standort in
              Deutschland. Alle eingebundenen Schriftarten werden ebenfalls direkt von diesem Server
              ausgeliefert (kein externes Nachladen, z. B. von Google Fonts) — beim Seitenaufruf werden
              daher keine Daten an Drittanbieter übertragen.
            </p>
          </section>

          <section>
            <h2 className="font-semibold mb-1">7. Ihre Rechte</h2>
            <p>
              Sie haben jederzeit das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der
              Verarbeitung Ihrer personenbezogenen Daten sowie das Recht auf Datenübertragbarkeit und
              Widerspruch. Wenden Sie sich dazu an die oben genannte Kontaktadresse.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
