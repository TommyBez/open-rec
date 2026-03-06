import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { capabilityCards, downloads, positioningPillars } from "@/lib/downloads";

const pageHighlights = [
  {
    label: "workflow",
    value: `${capabilityCards.length} parts`,
    detail: "capture, edit, and export in one desktop app",
  },
  {
    label: "price",
    value: "free",
    detail: "no trial gate between you and a usable recorder",
  },
  {
    label: "source",
    value: "open",
    detail: "public code, issues, and downloads on GitHub",
  },
] as const;

export default function Home() {
  return (
    <main className="relative isolate">
      <div className="hero-glow absolute inset-x-0 top-16 z-0 mx-auto h-80 w-[min(72rem,88vw)] rounded-full opacity-80" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="landing-panel flex items-center justify-between gap-4 rounded-full border border-white/10 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
              OpenRec / Desktop
            </Badge>
            <p className="hidden text-sm text-muted-foreground sm:block">
              Free and open-source screen recorder and editor for clear handoffs.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <a className="rounded-full px-3 py-1.5 transition hover:text-foreground" href="#features">
              Features
            </a>
            <a className="rounded-full px-3 py-1.5 transition hover:text-foreground" href="#open-source">
              Open source
            </a>
            <a className="rounded-full px-3 py-1.5 transition hover:text-foreground" href="#downloads">
              Download
            </a>
            <a
              className="rounded-full px-3 py-1.5 transition hover:text-foreground"
              href="https://github.com/TommyBez/open-rec"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
          <Card className="landing-panel relative overflow-hidden border-white/10">
            <div className="eyebrow-grid absolute inset-y-0 right-0 hidden w-2/5 opacity-30 lg:block" />
            <CardHeader className="relative gap-6 px-6 pt-8 pb-0 sm:px-8 sm:pt-10">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-full">Free to download</Badge>
                <Badge variant="outline" className="rounded-full border-white/12 bg-white/4">
                  Open source
                </Badge>
                <Badge variant="outline" className="rounded-full border-white/12 bg-white/4">
                  macOS + Linux
                </Badge>
              </div>

              <div className="max-w-4xl space-y-5">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/90">
                  OpenRec / record it once, share the full context
                </p>
                <h1 className="max-w-4xl font-display text-5xl leading-[0.9] tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
                  The free, open-source screen recorder built for real handoffs.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                  Capture screen, window, camera, and mic in one desktop app. Trim the timeline,
                  highlight the important moment, then export an MP4 or GIF people can actually use.
                </p>
              </div>
            </CardHeader>

            <CardContent className="relative mt-8 flex flex-col gap-8 px-6 pb-8 sm:px-8 sm:pb-10">
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-6">
                  <a href="#downloads">Download free builds</a>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full px-6">
                  <a
                    href="https://github.com/TommyBez/open-rec"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on GitHub
                  </a>
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {pageHighlights.map((metric) => (
                  <div
                    key={metric.label}
                    className="rounded-[1.4rem] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary/85">
                      {metric.label}
                    </p>
                    <p className="mt-3 font-display text-4xl tracking-[-0.06em]">{metric.value}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.detail}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="landing-panel border-white/10">
            <CardHeader className="gap-4 px-6 pt-8 pb-0">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.28em] text-primary/90">
                    Why OpenRec
                  </p>
                  <CardTitle className="mt-3 font-display text-3xl tracking-[-0.05em]">
                    Keep the pitch simple.
                  </CardTitle>
                </div>
                <span className="signal-dot mt-1 size-3 rounded-full bg-primary" />
              </div>
              <CardDescription className="text-sm leading-7">
                It records, edits, and exports in one desktop app. The code is public. The
                download is free.
              </CardDescription>
            </CardHeader>

            <CardContent className="mt-8 flex flex-1 flex-col gap-6 px-6 pb-8">
              <ul className="grid gap-4">
                {positioningPillars.map((pillar) => (
                  <li
                    key={pillar.title}
                    className="rounded-[1.25rem] border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-foreground/92"
                  >
                    <div className="flex gap-3">
                      <span className="signal-dot mt-2 size-2.5 shrink-0 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium text-foreground">{pillar.title}</p>
                        <p className="mt-1 text-muted-foreground">{pillar.body}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <Button asChild variant="outline" className="mt-auto h-11 rounded-full">
                <a href="https://github.com/TommyBez/open-rec" target="_blank" rel="noreferrer">
                  Browse the source
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="features" className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="landing-panel border-white/10">
            <CardHeader className="gap-3 px-6 pt-8 pb-0 sm:px-8">
              <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 text-primary">
                Features
              </Badge>
              <CardTitle className="font-display text-4xl tracking-[-0.05em] text-balance sm:text-5xl">
                Everything you need to go from rough capture to clean share.
              </CardTitle>
            </CardHeader>

            <CardContent className="mt-8 grid gap-4 px-6 pb-8 sm:px-8 sm:pb-10">
              {capabilityCards.map((card, index) => (
                <div
                  key={card.title}
                  className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-start"
                >
                  <div className="font-mono text-xs uppercase tracking-[0.28em] text-primary/90">
                    0{index + 1}
                  </div>
                  <div className="space-y-2">
                    <h2 className="font-display text-3xl tracking-[-0.05em]">{card.title}</h2>
                    <p className="max-w-2xl text-sm leading-7 text-muted-foreground">{card.body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card id="open-source" className="landing-panel border-white/10">
            <CardHeader className="gap-3 px-6 pt-8 pb-0">
              <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 text-primary">
                Open source + free
              </Badge>
              <CardTitle className="font-display text-4xl tracking-[-0.05em]">
                No black box. No subscription wall.
              </CardTitle>
              <CardDescription className="text-sm leading-7">
                OpenRec is public on GitHub and free to use. Review the code, file issues, fork it,
                or just download it when you need a recorder that does the job.
              </CardDescription>
            </CardHeader>

            <CardContent className="mt-8 flex flex-col gap-4 px-6 pb-8">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary/85">
                  Use it right away
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Download a free build for macOS or Linux and start recording in a workflow that
                  stays focused on the capture itself.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary/85">
                  Inspect how it works
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Follow the roadmap, read the code, and keep up with improvements in the open on
                  GitHub.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary/85">
                  Keep control of the output
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Export standard files, save projects for later edits, and reuse your work instead
                  of locking it into a closed workflow.
                </p>
              </div>
              <Button asChild variant="outline" className="mt-auto h-11 rounded-full">
                <a href="https://github.com/TommyBez/open-rec" target="_blank" rel="noreferrer">
                  Explore the GitHub repo
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="downloads" className="grid gap-5 pt-2">
          <div className="max-w-3xl space-y-4 px-1">
            <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 text-primary">
              Free downloads
            </Badge>
            <h2 className="font-display text-4xl tracking-[-0.05em] text-balance sm:text-5xl lg:text-6xl">
              Pick your platform and start recording.
            </h2>
            <p className="text-base leading-8 text-muted-foreground">
              Choose the build that matches your machine and grab OpenRec without pricing plans,
              upgrade prompts, or extra friction.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {downloads.map((download) => (
              <Card
                key={`${download.platform}-${download.artifact}`}
                className="landing-panel border-white/10 transition-transform duration-200 hover:-translate-y-1"
              >
                <CardHeader className="gap-4 px-6 pt-6 pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Badge variant="outline" className="rounded-full border-white/12 bg-white/4">
                      {download.platform}
                    </Badge>
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-primary/85">
                      {download.artifact}
                    </p>
                  </div>
                  <CardTitle className="font-display text-3xl tracking-[-0.05em]">
                    {download.artifact}
                  </CardTitle>
                  <CardDescription className="text-sm leading-7">{download.note}</CardDescription>
                </CardHeader>

                <CardContent className="mt-8 flex flex-col gap-4 px-6 pb-6">
                  <div className="h-px w-full bg-white/10" />
                  <div className="flex flex-wrap gap-3">
                    <Button asChild className="rounded-full">
                      <a href={download.href}>Download free build</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
