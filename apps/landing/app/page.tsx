import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { capabilityCards, downloads, releaseSignals } from "@/lib/downloads";

const operatingMetrics = [
  {
    label: "release assets",
    value: `${downloads.length}`,
    detail: "direct links stay pinned to the latest GitHub release",
  },
  {
    label: "workflow blocks",
    value: `${capabilityCards.length}`,
    detail: "capture, edit, and export map to one operator flow",
  },
  {
    label: "trust signals",
    value: `${releaseSignals.length}`,
    detail: "CI-backed builds with checksums beside each binary",
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
              Recorder and editor for teams that need a file they can trust.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <a className="rounded-full px-3 py-1.5 transition hover:text-foreground" href="#downloads">
              Latest builds
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
                <Badge className="rounded-full">Release-ready previews</Badge>
                <Badge variant="outline" className="rounded-full border-white/12 bg-white/4">
                  macOS + Linux
                </Badge>
              </div>

              <div className="max-w-4xl space-y-5">
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary/90">
                  OpenRec / capture the proof, edit the mess, ship the file
                </p>
                <h1 className="max-w-4xl font-display text-5xl leading-[0.9] tracking-[-0.06em] text-balance sm:text-6xl lg:text-7xl">
                  Broadcast-grade screen capture for messy, real-world handoff.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
                  OpenRec is a desktop recorder and timeline editor built for operators, support
                  engineers, and product teams who need recoverable capture flows and verifiable
                  release artifacts instead of another throwaway browser tab.
                </p>
              </div>
            </CardHeader>

            <CardContent className="relative mt-8 flex flex-col gap-8 px-6 pb-8 sm:px-8 sm:pb-10">
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg" className="rounded-full px-6">
                  <a href="#downloads">Download preview builds</a>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full px-6">
                  <a
                    href="https://github.com/TommyBez/open-rec/blob/main/docs/UNSIGNED_MAC_INSTALL.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read install notes
                  </a>
                </Button>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {operatingMetrics.map((metric) => (
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
                    Release signal
                  </p>
                  <CardTitle className="mt-3 font-display text-3xl tracking-[-0.05em]">
                    CI-backed delivery posture.
                  </CardTitle>
                </div>
                <span className="signal-dot mt-1 size-3 rounded-full bg-primary" />
              </div>
              <CardDescription className="text-sm leading-7">
                Preview builds stay current because every download points at the latest GitHub
                release asset. Checksums ship beside each binary for verification.
              </CardDescription>
            </CardHeader>

            <CardContent className="mt-8 flex flex-1 flex-col gap-6 px-6 pb-8">
              <ul className="grid gap-4">
                {releaseSignals.map((signal) => (
                  <li
                    key={signal}
                    className="rounded-[1.25rem] border border-white/10 bg-white/3 px-4 py-4 text-sm leading-7 text-foreground/92"
                  >
                    <div className="flex gap-3">
                      <span className="signal-dot mt-2 size-2.5 shrink-0 rounded-full bg-primary" />
                      <span>{signal}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[1.25rem] border border-white/10 bg-black/25 p-4">
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary/85">
                    unsigned previews
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    macOS builds are intentionally unsigned so the page can expose fresh preview
                    artifacts as soon as CI publishes them.
                  </p>
                </div>
                <div className="rounded-[1.25rem] border border-white/10 bg-black/25 p-4">
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary/85">
                    linux-ready
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Linux packages assume `ffmpeg` is available on `PATH` before you start
                    recording.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <Card className="landing-panel border-white/10">
            <CardHeader className="gap-3 px-6 pt-8 pb-0 sm:px-8">
              <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 text-primary">
                Operating posture
              </Badge>
              <CardTitle className="font-display text-4xl tracking-[-0.05em] text-balance sm:text-5xl">
                Built for the moment when the recording has to survive contact with reality.
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

          <Card className="landing-panel border-white/10">
            <CardHeader className="gap-3 px-6 pt-8 pb-0">
              <Badge variant="outline" className="rounded-full border-white/12 bg-white/4">
                Installation guidance
              </Badge>
              <CardTitle className="font-display text-4xl tracking-[-0.05em]">
                Preview build caveats, upfront.
              </CardTitle>
              <CardDescription className="text-sm leading-7">
                The landing page stays honest about platform setup so the first run feels expected,
                not mysterious.
              </CardDescription>
            </CardHeader>

            <CardContent className="mt-8 flex flex-col gap-4 px-6 pb-8">
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary/85">
                  macOS
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Open the unsigned app from Finder with a right click, then confirm the security
                  dialog to whitelist the preview build.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.24em] text-primary/85">
                  Linux
                </p>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Ensure `ffmpeg` is on `PATH` before recording so the capture pipeline can start
                  cleanly.
                </p>
              </div>
              <Button asChild variant="outline" className="mt-auto h-11 rounded-full">
                <a
                  href="https://github.com/TommyBez/open-rec/blob/main/docs/UNSIGNED_MAC_INSTALL.md"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read the install guide
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>

        <section id="downloads" className="grid gap-5 pt-2">
          <div className="max-w-3xl space-y-4 px-1">
            <Badge variant="outline" className="rounded-full border-primary/25 bg-primary/8 text-primary">
              Artifacts
            </Badge>
            <h2 className="font-display text-4xl tracking-[-0.05em] text-balance sm:text-5xl lg:text-6xl">
              Download the latest release builds without hunting through release notes.
            </h2>
            <p className="text-base leading-8 text-muted-foreground">
              Every link points to the latest GitHub release asset. Grab the binary, verify the
              published SHA256 file, and move on with the recording.
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
                      <a href={download.href}>Download build</a>
                    </Button>
                    <Button asChild variant="outline" className="rounded-full">
                      <a href={download.checksumHref}>View SHA256</a>
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
