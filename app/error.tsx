"use client";
import { Page } from "@/ui/bits";
import { Button } from "@/ui/button";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Page title="Something went wrong" sub="Nothing was changed. Try again.">
      <Button onClick={reset} className="justify-self-start">
        Try again
      </Button>
    </Page>
  );
}
