import { Page } from "@/ui/bits";
import { ButtonLink } from "@/ui/button";

export default function NotFound() {
  return (
    <Page title="Not found" sub="This page doesn't exist, or it isn't yours to see.">
      <ButtonLink href="/" className="justify-self-start">
        Go home
      </ButtonLink>
    </Page>
  );
}
