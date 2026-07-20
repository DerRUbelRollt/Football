import { Link } from "@tanstack/react-router";

export function LegalFooter() {
  return (
    <footer className="py-4 text-center text-xs text-muted-foreground/60">
      <Link to="/impressum" className="hover:text-muted-foreground">
        Impressum
      </Link>
      <span className="mx-2">·</span>
      <Link to="/datenschutz" className="hover:text-muted-foreground">
        Datenschutz
      </Link>
    </footer>
  );
}
